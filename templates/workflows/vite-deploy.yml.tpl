name: Build & Deploy to ECS

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: {{ECR_REPO}}
  ECS_CLUSTER: boogiepop-api-cluster
  ECS_SERVICE: {{ECS_SERVICE}}
  GITHUB_ACTIONS_ROLE_ARN: arn:aws:iam::653876198281:role/boogiepop-api-github-actions

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout app
        uses: actions/checkout@v4
        with:
          path: {{APP_SLUG}}

      - name: Checkout auth-sdk
        uses: actions/checkout@v4
        with:
          repository: blanck1945/boogiepop-auth-sdk
          path: boogiepop-auth-sdk

      - name: Checkout boogiepop-ui
        uses: actions/checkout@v4
        with:
          repository: blanck1945/boogiepop-ui
          path: boogiepop-ui

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ env.GITHUB_ACTIONS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          platforms: linux/arm64

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: {{APP_SLUG}}/Dockerfile
          push: true
          platforms: linux/arm64
          build-args: |
            VITE_REMOTE_BASE=/{{HTTP_PATH}}/
            NGINX_BASE_PATH={{HTTP_PATH}}
            VITE_DEV_SERVER_ORIGIN=http://localhost:5173
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }}
            ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment \
            --region $AWS_REGION
