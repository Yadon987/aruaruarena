terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = var.aws_region
}

# Lambda@Edgeはus-east-1での作成が必須
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
