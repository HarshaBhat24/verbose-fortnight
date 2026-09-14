# Epicor Product Development Internship Rubric

- ADO & CI/CD Pipeline Orchestration: Creating and managing Azure DevOps (ADO) pipelines for CI/CD orchestration where each pipeline runs against agent VMs executing PowerShell scripts as the execution layer
- VM Cleanup PowerShell Script (Star Achievement): Authoring a PowerShell cleanup script from scratch, deployed across 5 agent VMs via ADO pipeline, auto-triggered weekly to clear ~15 GB of logs and temp junk per run, eliminating pipeline failures caused by VM storage exhaustion
- UI Automation (TypeScript): Automating application clicking, interaction, and navigation of an enterprise application using TypeScript for workflow and test automation
- Python / Locust Load Testing: Writing and executing Python scripts using Locust to put concurrent load on enterprise application URLs, launching multiple parallel Chrome instances to stress test UI interactions under load for DoS and API resilience
- Database & SQL Management (SSMS): SQL querying and data retrieval using Microsoft SSMS for project data validation; performing database backup and restoration
- Log Analysis & Root Cause Analysis: Executing systematic log inspection and execution path tracing on PowerShell script execution logs and pipeline failure output to isolate failure root causes (VM storage exhaustion, network connectivity drops, script execution errors)
- DevSecOps & Pipeline Hygiene: Ensuring least privilege execution on agent VMs, pipeline reliability engineering, and migration of legacy Jenkins pipelines to Azure DevOps
