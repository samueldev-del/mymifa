# ---------------------------------------------------------------------------
# Déploiement de démonstration : l'API MyMifa sur ECS Fargate.
#
# TEMPORAIRE. Cette infrastructure est montée pour démontrer un déploiement
# conteneurisé, puis détruite par `terraform destroy -target`. L'application
# reste hébergée sur Vercel.
#
# L'ALB et Fargate sont facturés à l'heure indépendamment du trafic :
# environ 0,90 $ par jour si laissés en marche.
# ---------------------------------------------------------------------------

# --- Réseau ----------------------------------------------------------------

# Zones de disponibilité de la région. Un ALB en exige au moins deux.
data "aws_availability_zones" "disponibles" {
  state = "available"
}

resource "aws_vpc" "demo" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "mymifa-demo" }
}

resource "aws_internet_gateway" "demo" {
  vpc_id = aws_vpc.demo.id
  tags   = { Name = "mymifa-demo" }
}

# Deux sous-réseaux PUBLICS, dans deux zones différentes.
#
# Choix assumé : les tâches Fargate y reçoivent une IP publique et sortent
# directement par l'Internet Gateway. En production, on les placerait dans
# des sous-réseaux privés derrière un NAT Gateway — mais celui-ci coûte
# ~32 $/mois, disproportionné pour une démonstration éphémère.
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.demo.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.disponibles.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "mymifa-demo-public-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.demo.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.demo.id
  }

  tags = { Name = "mymifa-demo-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- Pare-feu ---------------------------------------------------------------

# L'ALB accepte le trafic HTTP depuis Internet.
resource "aws_security_group" "alb" {
  name        = "mymifa-demo-alb"
  description = "Trafic HTTP entrant vers ALB"
  vpc_id      = aws_vpc.demo.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Les tâches n'acceptent QUE le trafic venant de l'ALB, jamais d'Internet
# directement. C'est la référence au security group de l'ALB qui l'impose,
# pas une plage d'adresses.
resource "aws_security_group" "tache" {
  name        = "mymifa-demo-tache"
  description = "Trafic depuis ALB uniquement"
  vpc_id      = aws_vpc.demo.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Sortie ouverte : la tâche doit joindre Neon, S3, l'API Anthropic
  # et le registre GHCR.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Répartiteur de charge --------------------------------------------------

resource "aws_lb" "demo" {
  name               = "mymifa-demo"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "demo" {
  name     = "mymifa-demo"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.demo.id
  # `ip` et non `instance` : Fargate n'expose pas d'instances EC2.
  target_type = "ip"

  # L'ALB tue et remplace toute tâche qui échoue ce contrôle.
  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "demo" {
  load_balancer_arn = aws_lb.demo.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.demo.arn
  }
}

# --- Rôles IAM --------------------------------------------------------------

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Rôle d'EXÉCUTION : utilisé par l'agent ECS pour tirer l'image, lire les
# secrets et écrire les logs — avant que le conteneur ne démarre.
resource "aws_iam_role" "ecs_execution" {
  name               = "mymifa-demo-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Lecture des seuls paramètres nécessaires, nommés explicitement.
data "aws_iam_policy_document" "ecs_ssm" {
  statement {
    actions = ["ssm:GetParameters"]
    resources = [
      "arn:aws:ssm:eu-central-1:944042567750:parameter/mymifa/database-url",
      "arn:aws:ssm:eu-central-1:944042567750:parameter/mymifa/admin-password",
      "arn:aws:ssm:eu-central-1:944042567750:parameter/mymifa/session-secret",
    ]
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

resource "aws_iam_role_policy" "ecs_ssm" {
  name   = "read-app-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_ssm.json
}

# --- Cluster, tâche, service ------------------------------------------------

resource "aws_ecs_cluster" "demo" {
  name = "mymifa-demo"
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/mymifa-demo"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "demo" {
  family                   = "mymifa-demo"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  # La plus petite taille Fargate disponible.
  cpu                = 256
  memory             = 512
  execution_role_arn = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "ghcr.io/samueldev-del/mymifa/api:latest"

      portMappings = [{ containerPort = 3000, protocol = "tcp" }]

      # Valeurs non sensibles : elles peuvent figurer en clair.
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "AWS_REGION", value = "eu-central-1" },
        { name = "AWS_S3_BUCKET_NAME", value = "mymifa-api-s3" },
        { name = "FRONTEND_ORIGIN", value = "https://www.mymifa.com" },
      ]

      # Secrets : résolus par l'agent ECS au démarrage, jamais dans le state
      # ni dans la définition de tâche.
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:ssm:eu-central-1:944042567750:parameter/mymifa/database-url" },
        { name = "ADMIN_PASSWORD", valueFrom = "arn:aws:ssm:eu-central-1:944042567750:parameter/mymifa/admin-password" },
        { name = "SESSION_SECRET", valueFrom = "arn:aws:ssm:eu-central-1:944042567750:parameter/mymifa/session-secret" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = "eu-central-1"
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "demo" {
  name            = "mymifa-demo"
  cluster         = aws_ecs_cluster.demo.id
  task_definition = aws_ecs_task_definition.demo.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.public[*].id
    security_groups = [aws_security_group.tache.id]
    # Sans IP publique, la tâche ne pourrait pas tirer l'image depuis GHCR :
    # il n'y a pas de NAT Gateway dans ce montage.
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.demo.arn
    container_name   = "api"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.demo]
}

# --- Sortie -----------------------------------------------------------------

output "url_demo" {
  description = "URL publique du déploiement de démonstration."
  value       = "http://${aws_lb.demo.dns_name}"
}