-- Trilha da Inclusão CAR — Setembro Verde 2026
-- Script manual de criação das tabelas no SQL Server.
--
-- Uso: rode este script UMA VEZ, com um login que tenha permissão de DDL
-- (db_owner ou similar), antes de subir a aplicação com DB_AUTO_MIGRATE=false.
-- Se preferir, a própria aplicação cria essas tabelas sozinha na primeira
-- vez que sobe (comportamento padrão, DB_AUTO_MIGRATE não definido ou
-- diferente de "false") — nesse caso este script serve só como referência.
--
-- Recomendação de segurança: depois de criar as tabelas, use um login de
-- aplicação separado, com permissão apenas de SELECT/INSERT nestas 4
-- tabelas (sem DDL), e rode a aplicação com DB_AUTO_MIGRATE=false.

IF OBJECT_ID('dbo.TrilhaRespostas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrilhaRespostas (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaRespostas_Id DEFAULT NEWID() PRIMARY KEY,
    Texto NVARCHAR(500) NOT NULL,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaRespostas_CriadoEm DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.TrilhaCompromissos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrilhaCompromissos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaCompromissos_Id DEFAULT NEWID() PRIMARY KEY,
    Itens NVARCHAR(MAX) NULL,        -- lista de atitudes marcadas, em JSON
    Compromisso NVARCHAR(300) NULL,  -- texto livre do compromisso
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaCompromissos_CriadoEm DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.TrilhaFolhas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrilhaFolhas (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaFolhas_Id DEFAULT NEWID() PRIMARY KEY,
    Texto NVARCHAR(120) NOT NULL,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaFolhas_CriadoEm DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.TrilhaQuiz', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrilhaQuiz (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaQuiz_Id DEFAULT NEWID() PRIMARY KEY,
    Acertos INT NOT NULL,
    Total INT NOT NULL,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaQuiz_CriadoEm DEFAULT SYSUTCDATETIME()
  );
END
GO

-- Nenhuma tabela guarda nome, e-mail, matrícula, IP ou qualquer outro dado
-- que identifique quem respondeu — a participação é intencionalmente anônima.
