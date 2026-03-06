# AWS Quick Deploy

Deploy automatico do `LavaJato` em uma unica EC2 com persistencia real:

- PostgreSQL em container Docker
- API Node/Express em container Docker
- Frontend Vite servido por Nginx em container Docker

## Arquitetura

- `postgres`: banco persistente com volume Docker
- `api`: backend em `http://api:4000`
- `web`: frontend publicado em `http://IP_PUBLICO/`
- `web -> /api`: proxy reverso para a API

## Arquivos

- `ec2-user-data.sh`: bootstrap completo da EC2
- `ec2-assume-role.json`: trust policy da role da EC2
- `ec2-bdm.json`: volume raiz da instancia

## Requisitos na AWS

- AMI Amazon Linux 2023
- Security Group com:
  - `80/tcp` liberado
  - `22/tcp` opcional
- IAM Role com `AmazonSSMManagedInstanceCore`

## Como funciona o bootstrap

1. instala Docker
2. instala Docker Compose plugin
3. clona `https://github.com/dmitrymarcelo/LavaJato.git`
4. faz checkout do branch `main`
5. executa `docker compose up -d --build`
6. publica a aplicacao em `http://IP_PUBLICO/`

## Banco de dados

O PostgreSQL sobe com estes parametros padrao:

```text
database: lavajato
user: postgres
password: postgres
```

O volume Docker `postgres_data` garante persistencia entre reinicios da EC2.

## Credencial inicial

O seed do backend cria um usuario inicial:

```text
matricula: 1001
senha: Admin@123456!
```

## Exemplo de criacao por AWS CLI

```bash
aws iam create-role \
  --role-name LavaJatoEc2Role \
  --assume-role-policy-document file://infra/aws/ec2-assume-role.json

aws iam attach-role-policy \
  --role-name LavaJatoEc2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

aws iam create-instance-profile \
  --instance-profile-name LavaJatoEc2Profile

aws iam add-role-to-instance-profile \
  --instance-profile-name LavaJatoEc2Profile \
  --role-name LavaJatoEc2Role

aws ec2 run-instances \
  --image-id ami-xxxxxxxx \
  --instance-type t3.small \
  --iam-instance-profile Name=LavaJatoEc2Profile \
  --security-group-ids sg-xxxxxxxx \
  --subnet-id subnet-xxxxxxxx \
  --block-device-mappings file://infra/aws/ec2-bdm.json \
  --user-data file://infra/aws/ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=LavaJatoDemo}]'
```
