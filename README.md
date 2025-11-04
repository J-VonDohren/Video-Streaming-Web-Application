# Newstube – AWS Microservices News Video Streaming Platform
**Author:** Jake Von Dohren (n11970677)  
**Unit:** CAB432 – Cloud Computing  
**Institution:** Queensland University of Technology  

---

## Overview
**Newstube** is a cloud-based platform designed for reporters and civilians to upload, share, and view news videos.  
The application allows users to:
- Upload video files to AWS S3
- Retrieve stored videos
- View associated video metadata
- Transcode videos to various resolutions
- Receive article recommendations using an external API (via AWS Secrets Manager)

---

## Architecture

### Core AWS Services
| Service | Purpose |
|----------|----------|
| **Amazon EC2** | Hosts the backend API and provides compute for processing tasks such as transcoding videos. |
| **Amazon S3** | Stores user-uploaded video files in a cost-effective and scalable manner. |
| **Amazon DynamoDB** | Stores video metadata, providing high availability and fast indexing. |
| **AWS Systems Manager Parameter Store** | Stores configuration values such as S3 bucket names and DynamoDB table names securely. |
| **AWS Secrets Manager** | Manages and encrypts sensitive data such as API keys for the article-recommendation service. |
| **Amazon Cognito** | Handles user authentication, registration, and secure login flows. |
| **AWS Certificate Manager (ACM)** | Provides HTTPS security via SSL/TLS certificates. |
| **Amazon Route 53** | Routes domain traffic to the load balancer for secure DNS resolution. |
| **Elastic Load Balancer (ALB)** | Distributes traffic evenly across EC2 instances to enhance reliability and scalability. |
| **Auto Scaling Group** | Automatically scales EC2 instances up or down depending on demand. |

---

## Cloud Infrastructure Summary
- **EC2 Instance Name:** `n11970677-newstube`
- **Load Balancer:** `n11970677-newstube-LB`
- **Auto Scaling Group:** `n11970677-newstube-autoscalingGroup`
- **Domain:** `newstube.cab432.com`
- **Certificate ARN:** `15b92837-36b7-4ccd-b7ad-66a2ab02ee7d`
- **AWS Region:** `ap-southeast-2 (Sydney)`

---

## Security
- All traffic is served over **HTTPS** using AWS Certificate Manager.
- **Secrets Manager** encrypts sensitive credentials (e.g., API keys) using envelope encryption.
- **Cognito** manages authentication and enforces the principle of least privilege through user groups.
- **Optional MFA** can be enabled to strengthen user authentication.
- **IAM Roles** are scoped to least-privilege access for EC2, S3, DynamoDB, and Systems Manager.

---

## Scalability
The platform scales dynamically using **Auto Scaling Groups** and **Application Load Balancers**.  
For larger workloads (e.g., >10,000 concurrent users), **ECS** container orchestration is recommended to:
- Optimize resource usage  
- Improve fault tolerance  
- Enable automatic container restart  
- Reduce operational overhead  

A **Dead Letter Queue (DLQ)** can also be integrated to handle failed video-processing requests gracefully.

---

## Cost Overview
| Service | Monthly Cost | Upfront |
|----------|---------------|----------|
| EC2 | $259.15 | $0.00 |
| DynamoDB | $40.49 | $0.00 |
| S3 | $0.08 | $0.00 |
| Cognito | $305.11 | $0.00 |
| Secrets Manager | $1.20 | $0.00 |
| Systems Manager | $0.27 | $0.00 |
| Route 53 | $2,500.50 | $0.00 |

[Full AWS Pricing Estimate](https://calculator.aws/#/estimate?id=423c5ac3fc834c061422f74ac0da3cd6bb969f9d)

---

## Sustainability
- Hosted in **AWS Sydney (ap-southeast-2)** — a **100% renewable-powered region**.
- Auto-scaling ensures efficient resource consumption.
- Future enhancements will leverage **AWS Lambda** for serverless efficiency.

---

## API Usage

Below is a guide for interacting with Newstube’s API.  

### Video Upload & Retrieval
- `POST /api/vid/file/upload` – Upload a new video file to S3.  
- `GET /api/vid/file/:id/metadata` – Retrieve video metadata.  
- `GET /api/vid/file/:id/download` – Stream the video file.  
- `GET /api/vid/file/:id/transcode?quality=720` – Retrieve a transcoded version of a video.  

### Article Recommendations
- `GET /api/vid/file/:id/article-recommendations` – Get related articles via Guardian API.

### Authentication (Cognito)
- `POST /api/auth/signup` – Register a new user.  
- `POST /api/auth/confirm` – Confirm signup via email verification code.  
- `POST /api/auth/login` – Log in and obtain tokens.  

---

## Setup Instructions

### 1 Clone the Repository
```bash
git clone https://github.com/<yourusername>/newstube.git
cd newstube
```
### 2 Install dependancies
```
npm install node
npm install express
npm install ffmpeg
```

