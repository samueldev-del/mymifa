terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # State séparé de celui de l'infrastructure permanente.
  #
  # Cette configuration décrit une démonstration éphémère : montée pour
  # prouver un déploiement conteneurisé, puis détruite. La garder dans le
  # state principal ferait proposer 19 créations à chaque `plan`, un bruit
  # permanent qui finirait par masquer une vraie dérive.
  #
  # Même bucket, clé différente.
  backend "s3" {
    bucket       = "mymifa-tfstate-944042567750"
    key          = "demo-ecs/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "eu-central-1"

  default_tags {
    tags = {
      Project   = "mymifa"
      ManagedBy = "terraform"
      Lifecycle = "ephemeral"
    }
  }
}