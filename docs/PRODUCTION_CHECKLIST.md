# Production launch checklist

Before allowing the public to register:
1. Use a strong random JWT secret in environment variables.
2. Put the API behind HTTPS.
3. Move SQLite to PostgreSQL/MySQL for multi-instance production.
4. Add rate limiting and abuse monitoring.
5. Add email/phone verification and account recovery.
6. Add secure image uploads with MIME/type/size validation and malware/content moderation.
7. Add automated and human moderation for profiles, images and messages.
8. Add age verification where legally required.
9. Add privacy policy, terms, deletion/export requests and retention rules.
10. Add backups, logging, monitoring and an admin moderation dashboard.
11. Never claim police notification unless there is an actual legal/reporting workflow.
12. Test payment features separately if subscriptions are added.
