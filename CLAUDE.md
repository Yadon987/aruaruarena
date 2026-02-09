# CLAUDE.md

## Build & Test Commands
- **Run All Tests**: `./scripts/test_all.sh`
  - Runs RuboCop (auto-correct), Brakeman, DynamoDB Local check, and RSpec.
- **RuboCop (Auto Correct)**: `bundle exec rubocop -a`
- **RuboCop (Check only)**: `bundle exec rubocop`
- **Brakeman**: `bundle exec brakeman`
- **RSpec**: `bundle exec rspec`

## Reference Commands
- **List Files**: `ls -la`
- **File Content**: `cat`
- **Git Status**: `git status`
- **Git Log**: `git log --oneline -n 20`
- **Git Diff**: `git diff`

## Server Commands
- **Rails Server**: `bundle exec rails s`
- **Rails Console**: `bundle exec rails c`

## Infrastructure
- **Terraform Plan**: `cd backend/terraform && terraform plan`
- **Terraform Apply**: `cd backend/terraform && terraform apply`
