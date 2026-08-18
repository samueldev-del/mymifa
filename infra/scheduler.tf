# ---------------------------------------------------------------------------
# Remplacement du cron GitHub Actions.
#
# L'événement `schedule` de GitHub est traité en « meilleur effort » : mesuré
# à 19 exécutions par jour au lieu des 96 configurées, avec des écarts allant
# jusqu'à 2h43. EventBridge Scheduler est ponctuel.
#
# Chaîne : Scheduler --(rôle IAM)--> Lambda --HTTP--> API MyMifa
# ---------------------------------------------------------------------------

# Le secret n'est pas géré par Terraform : le déclarer en ressource écrirait
# sa valeur dans le state. On le lit seulement, il a été créé hors du code.
data "aws_ssm_parameter" "email_webhook_secret" {
  name = "/mymifa/email-webhook-secret"
}

# --- Packaging de la Lambda ------------------------------------------------

# Terraform construit lui-même l'archive à partir du source. Le hash du
# fichier déclenche un redéploiement quand le code change.
data "archive_file" "sync_emails" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/sync-emails"
  output_path = "${path.module}/build/sync-emails.zip"
}

# --- Rôle d'exécution de la Lambda -----------------------------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sync_emails" {
  name               = "mymifa-sync-emails-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Écriture des logs CloudWatch : le strict minimum pour une Lambda.
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.sync_emails.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lecture du seul paramètre dont la fonction a besoin — pas de `ssm:*`,
# pas de `Resource = "*"`.
data "aws_iam_policy_document" "lambda_ssm" {
  statement {
    actions   = ["ssm:GetParameter"]
    resources = [data.aws_ssm_parameter.email_webhook_secret.arn]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.eu-central-1.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lambda_ssm" {
  name   = "read-webhook-secret"
  role   = aws_iam_role.sync_emails.id
  policy = data.aws_iam_policy_document.lambda_ssm.json
}

# --- La fonction ------------------------------------------------------------

resource "aws_lambda_function" "sync_emails" {
  function_name = "mymifa-sync-emails"
  role          = aws_iam_role.sync_emails.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"

  filename         = data.archive_file.sync_emails.output_path
  source_code_hash = data.archive_file.sync_emails.output_base64sha256

  # La synchronisation lit une boîte IMAP : elle peut prendre du temps.
  timeout     = 130
  memory_size = 256

  environment {
    variables = {
      API_URL      = "https://mymifa.vercel.app"
      SECRET_PARAM = data.aws_ssm_parameter.email_webhook_secret.name
    }
  }
}

# Rétention des logs : sans cette ressource, CloudWatch conserve
# indéfiniment et facture le stockage.
resource "aws_cloudwatch_log_group" "sync_emails" {
  name              = "/aws/lambda/${aws_lambda_function.sync_emails.function_name}"
  retention_in_days = 14
}

# --- Rôle assumé par le Scheduler ------------------------------------------

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "mymifa-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "scheduler_invoke" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.sync_emails.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name   = "invoke-sync-emails"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_invoke.json
}

# --- La planification -------------------------------------------------------

resource "aws_scheduler_schedule" "sync_emails" {
  name                = "mymifa-sync-emails"
  schedule_expression = "rate(15 minutes)"

  # Pas de fenêtre de tolérance : on veut une exécution ponctuelle, c'est
  # tout l'intérêt par rapport au cron GitHub.
  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.sync_emails.arn
    role_arn = aws_iam_role.scheduler.arn

    retry_policy {
      maximum_retry_attempts = 2
    }
  }
}