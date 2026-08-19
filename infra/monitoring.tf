# ---------------------------------------------------------------------------
# Surveillance de la chaîne de synchronisation des emails.
#
# Deux défauts distincts, deux alarmes :
#  - la Lambda s'exécute mais échoue  -> métrique Errors
#  - la Lambda ne s'exécute plus      -> absence d'Invocations
#
# Le second est le plus insidieux : aucune erreur n'est produite, il ne se
# passe simplement rien. C'est le défaut qu'avait le cron GitHub pendant
# des semaines sans que personne ne le voie.
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alertes" {
  name = "mymifa-alertes"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alertes.arn
  protocol  = "email"
  endpoint  = "samueldjommou@icloud.com"
}

# --- La Lambda échoue -------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "lambda_erreurs" {
  alarm_name        = "mymifa-sync-emails-erreurs"
  alarm_description = "La synchronisation des emails a échoué au moins deux fois en 30 minutes."

  namespace   = "AWS/Lambda"
  metric_name = "Errors"
  statistic   = "Sum"

  dimensions = {
    FunctionName = aws_lambda_function.sync_emails.function_name
  }

  # Deux périodes de 15 minutes : une erreur isolée peut venir d'un hoquet
  # réseau, deux consécutives indiquent un vrai problème.
  period              = 900
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"

  # Pas d'invocation = pas d'erreur. L'absence de donnée n'est donc pas
  # un signal ici : c'est l'autre alarme qui couvre ce cas.
  treat_missing_data = "notBreaching"

  alarm_actions = [aws_sns_topic.alertes.arn]
  ok_actions    = [aws_sns_topic.alertes.arn]
}

# --- La Lambda ne s'exécute plus --------------------------------------------

resource "aws_cloudwatch_metric_alarm" "lambda_silencieuse" {
  alarm_name        = "mymifa-sync-emails-silencieuse"
  alarm_description = "Aucune synchronisation depuis plus d'une heure alors qu'elle devrait tourner toutes les 15 minutes."

  namespace   = "AWS/Lambda"
  metric_name = "Invocations"
  statistic   = "Sum"

  dimensions = {
    FunctionName = aws_lambda_function.sync_emails.function_name
  }

  # Une heure sans la moindre invocation, alors qu'il devrait y en avoir
  # quatre. Marge volontaire : EventBridge est ponctuel, mais un retard
  # ponctuel ne doit pas déclencher.
  period              = 3600
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "LessThanThreshold"

  # Décisif : sans invocation, CloudWatch ne reçoit AUCUNE donnée. Par
  # défaut il considérerait l'état comme « insuffisant » et ne déclencherait
  # rien — exactement le défaut qu'on cherche à détecter.
  treat_missing_data = "breaching"

  alarm_actions = [aws_sns_topic.alertes.arn]
  ok_actions    = [aws_sns_topic.alertes.arn]
}