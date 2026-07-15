-- Inicialização mínima do PostgreSQL local do SECC.
-- O usuário secc_app é criado pelo entrypoint da imagem oficial.

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO secc_app;

ALTER DATABASE secc SET timezone TO 'America/Sao_Paulo';
ALTER DATABASE secc SET statement_timeout TO '30s';
ALTER DATABASE secc SET idle_in_transaction_session_timeout TO '60s';
