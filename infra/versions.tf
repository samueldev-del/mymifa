terraform {
  # `use_lockfile` est stable depuis 1.11. On exige au moins cette version
  # pour éviter qu'un poste avec une version antérieure travaille sans verrou.
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Contrainte sur la majeure : on suit les correctifs et les nouvelles
      # ressources, jamais un changement cassant.
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket = "mymifa-tfstate-944042567750"
    key    = "global/terraform.tfstate"
    region = "eu-central-1"

    # Chiffrement côté client de la requête, en plus du chiffrement
    # par défaut configuré sur le bucket lui-même.
    encrypt = true

    # Verrouillage natif S3 par écriture conditionnelle : un fichier .tflock
    # est créé à côté du state. Remplace la table DynamoDB, dépréciée depuis 1.11.
    use_lockfile = true
  }
}

provider "aws" {
  region = "eu-central-1"

  # Toute ressource créée par Terraform porte ces étiquettes. Permet de
  # distinguer ce qui est géré par le code de ce qui a été créé à la main —
  # le bucket de state, notamment, ne les portera pas.
  default_tags {
    tags = {
      Project   = "mymifa"
      ManagedBy = "terraform"
    }
  }
}