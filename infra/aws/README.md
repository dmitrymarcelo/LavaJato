# AWS Quick Deploy

Deploy automatico do frontend `LavaJato` em uma EC2 Amazon Linux 2023 com Nginx.

## O que este bootstrap faz

- instala `git`, `nginx`, `nodejs` e `npm`
- clona `https://github.com/dmitrymarcelo/LavaJato.git`
- faz checkout do branch `main`
- executa `npm ci`
- executa `npm run build`
- publica o conteudo de `dist/` em `/usr/share/nginx/html`
- configura fallback SPA para `index.html`
- sobe o Nginx na porta `80`

## Arquivos

- `ec2-user-data.sh`: bootstrap completo da instancia
- `ec2-assume-role.json`: trust policy para role da EC2
- `ec2-bdm.json`: volume raiz gp3 de 20 GB

## Requisitos AWS

- AMI Amazon Linux 2023
- Security Group liberando:
  - `80/tcp` para acesso web
  - `22/tcp` apenas se voce precisar de SSH
- IAM Role com pelo menos `AmazonSSMManagedInstanceCore`

## Exemplo com AWS CLI

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
```

Depois lance a instancia:

```bash
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

## Resultado

Ao fim do bootstrap, o sistema fica disponivel no IP publico da EC2:

```text
http://SEU-IP-PUBLICO/
```
