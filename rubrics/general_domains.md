# General Security Domains Rubric

## Network Infrastructure Security (network_infra)
- Rules of engagement, testing window, emergency contact, break-glass procedure
- Port scanning (Nmap stealth vs full-connect, top-1000 vs full 65535 range), service fingerprinting, exposing unauthenticated internal microservices/ports
- Scanner output validation (nikto, Nmap scripts) vs manual verification
- Initial foothold, privilege escalation mechanics, lateral movement, cleanup & log retention

## Active Directory & Internal Pentesting (ad_internal)
- Assumed breach vs phishing-initiated vs physical foothold justification
- BloodHound/SharpHound/LDAP enumeration by specific query objective
- Kerberoasting & AS-REP Roasting mechanical explanation; Pass-the-Hash vs Pass-the-Ticket protocol differences
- GPO abuse, ACL/ACE permission abuse, unconstrained/constrained delegation mechanics to Domain Admin
- Operational security (OpSec) considerations for blue team SIEM/EDR detection evasion

## Cloud Security & IAM Architecture (cloud)
- Shared responsibility model, IAM misconfigurations (iam:PassRole abuse)
- Public storage S3/Blob policy evaluation, sensitive data discovery vs simple access checks
- Metadata service abuse (SSRF-to-IMDS pathways, IMDSv1 vs IMDSv2 mechanisms)
- CloudTrail audit logging coverage, log tampering detection, security event persistence
