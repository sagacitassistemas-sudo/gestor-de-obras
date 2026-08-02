SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict Miv7PxN5cvDkxsLc9HL8Bon35nfSD2l0p9TFMX2sPGL0xYbWYLYMpi6laKd2j1G

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: empresa_contratante; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."empresa_contratante" ("contrato_id", "natureza", "nome", "area", "departamento", "cnpj", "email", "telefone", "gestor_responsavel", "unidade_administrativa", "created_at", "updated_at") VALUES
	('CTR-2026-SYS', 'Privada', 'Sagacitas Sistemas', 'Tecnologia', 'Engenharia', NULL, NULL, NULL, NULL, NULL, '2026-08-02 13:49:47.775128+00', '2026-08-02 13:49:47.775128+00');


--
-- Data for Name: empresas_fornecedores; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: projetos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."projetos" ("id", "codigo_contrato", "nome_projeto", "data_inicio", "created_at", "updated_at") VALUES
	('0245894a-e335-4847-bfe2-55ea47439837', 'CT-001/2026', 'PROJETO DE ENGENHARIA IMPORTADO', '2026-08-02', '2026-08-02 14:01:20.085382+00', '2026-08-02 14:01:20.085382+00');


--
-- Data for Name: itens_eap; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."itens_eap" ("id", "projeto_id", "eap_codigo", "eap_pai_codigo", "descricao_servico", "unidade_medida", "preco_unitario", "quantidade_contratada", "valor_total_contratado", "e_analitico", "ordem", "created_at") VALUES
	('4ee2b730-010e-4c5a-9277-af7ef86deae2', '0245894a-e335-4847-bfe2-55ea47439837', '1', 'NaN', 'SERVIÇOS DE CONSULTORIA - PROJETO DE ENGENHARIA', 'NaN', 0.00, 0.0000, 258571.18, false, 1, '2026-08-02 14:01:20.085382+00'),
	('28e794f9-e0cc-4e3b-b6ab-4572fc953824', '0245894a-e335-4847-bfe2-55ea47439837', '1.1', '1', 'PROJETO BÁSICO DE ENGENHARIA', 'NaN', 0.00, 0.0000, 219373.69, false, 2, '2026-08-02 14:01:20.085382+00'),
	('79ec2937-e1d9-4b6f-b5c7-25b085d13209', '0245894a-e335-4847-bfe2-55ea47439837', '1.1.1', '1.1', 'Estudos Preliminares, Projetos e Meio Ambiente', 'ud', 219373.69, 1.0000, 219373.69, true, 3, '2026-08-02 14:01:20.085382+00'),
	('1445ac12-8a4f-43d1-bc53-6e2af7c34e4d', '0245894a-e335-4847-bfe2-55ea47439837', '1.2', '1', 'PROJETO EXECUTIVO DE ENGENHARIA', 'NaN', 0.00, 0.0000, 39197.49, false, 4, '2026-08-02 14:01:20.085382+00'),
	('f945ba13-e94c-4ec5-89fb-9f557a2caff0', '0245894a-e335-4847-bfe2-55ea47439837', '1.2.1', '1.2', 'Estudos Preliminares, Projetos e Meio Ambiente', 'ud', 39197.49, 1.0000, 39197.49, true, 5, '2026-08-02 14:01:20.085382+00'),
	('be5054b1-ae2f-41e3-bf4e-971bc149d703', '0245894a-e335-4847-bfe2-55ea47439837', '2', 'NaN', 'OBRA DE RESTAURAÇÃO DA RODOVIA DE SÃO JOAQUIM', 'NaN', 0.00, 0.0000, 33206629.14, false, 6, '2026-08-02 14:01:20.085382+00'),
	('25798d76-0dbb-45a0-aaba-343456f68f60', '0245894a-e335-4847-bfe2-55ea47439837', '2.1', '2', 'SERVIÇOS PRELIMINARES E TERRAPLENAGEM', 'NaN', 0.00, 0.0000, 2597715.98, false, 7, '2026-08-02 14:01:20.085382+00'),
	('30ae7928-4484-44ad-98d0-29fb4405722d', '0245894a-e335-4847-bfe2-55ea47439837', '2.1.1', '2.1', 'Serviços Preliminares de Terraplenagem', 'hm', 45099.23, 57.6000, 2597715.98, true, 8, '2026-08-02 14:01:20.085382+00'),
	('a885b8b5-f778-4e62-8da6-96c33d5dd8d3', '0245894a-e335-4847-bfe2-55ea47439837', '2.2', '2', 'DRENAGEM E OAC', 'NaN', 0.00, 0.0000, 9764740.99, false, 9, '2026-08-02 14:01:20.085382+00'),
	('d7963e3f-56b1-4dce-b4e6-bd1d579e12f8', '0245894a-e335-4847-bfe2-55ea47439837', '2.2.1', '2.2', 'Drenagem Profunda (Bueiro, Dreno, Colchão Drenante)', 'hm', 116973.46, 57.6000, 6737671.29, true, 10, '2026-08-02 14:01:20.085382+00'),
	('b1b3d805-5e1e-4c86-8290-88317b512b3e', '0245894a-e335-4847-bfe2-55ea47439837', '2.2.2', '2.2', 'Drenagem Superficial (Sarjeta, Meio fio, canaleta)', 'hm', 52553.29, 57.6000, 3027069.70, true, 11, '2026-08-02 14:01:20.085382+00'),
	('a42ad249-aef0-442f-9eab-00eaa63c46a0', '0245894a-e335-4847-bfe2-55ea47439837', '2.3', '2', 'PAVIMENTAÇÃO', 'NaN', 0.00, 0.0000, 6934539.46, false, 12, '2026-08-02 14:01:20.085382+00'),
	('2b821845-fb7f-4fc7-aca9-2bf5cd9b5579', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.1', '2.3', 'Regularização e Compactação do Subleito', 'hm', 23759.07, 57.6000, 1368522.24, true, 13, '2026-08-02 14:01:20.085382+00'),
	('438b8385-2b73-41bb-869c-4b5808385df7', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.2', '2.3', 'Sub-base, Incluindo Escavação, Carga e Transporte', 'hm', 34569.61, 57.6000, 1991209.75, true, 14, '2026-08-02 14:01:20.085382+00'),
	('b63cbbc9-1362-4d2c-a600-67455b3d1874', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.3', '2.3', 'Base BGS, Tudo Incluído', 'hm', 34869.50, 57.6000, 2008483.06, true, 15, '2026-08-02 14:01:20.085382+00'),
	('30193f20-4b24-454a-b228-9cc83b97728c', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.4', '2.3', 'Pintura de Ligação', 'hm', 1840.75, 57.6000, 106027.24, true, 16, '2026-08-02 14:01:20.085382+00'),
	('3192b505-f7fc-48e6-bd7a-545e2379b135', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.5', '2.3', 'CBUQ - Binder, Incluindo Transporte dos Materiais', 'hm', 19277.82, 57.6000, 1110402.94, true, 17, '2026-08-02 14:01:20.085382+00'),
	('9e4de7ba-650d-4ed1-8756-e2e88d6efa5c', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.6', '2.3', 'CBUQ - CAPA (Faixa C), Incluindo Transporte dos Materiais', 'hm', 5576.70, 57.6000, 321217.91, true, 18, '2026-08-02 14:01:20.085382+00'),
	('03afecc6-c088-4e15-97ca-1a2ca5de4a64', '0245894a-e335-4847-bfe2-55ea47439837', '2.3.7', '2.3', 'Transporte da Massa Asfáltica', 'hm', 497.85, 57.6000, 28676.32, true, 19, '2026-08-02 14:01:20.085382+00'),
	('5e140f04-077f-4a9d-a54e-44f4a4fb7258', '0245894a-e335-4847-bfe2-55ea47439837', '2.4', '2', 'LIGANTES BETUMINOSOS (INCLUINDO BONIFICAÇÃO)', 'NaN', 0.00, 0.0000, 0.00, false, 20, '2026-08-02 14:01:20.085382+00'),
	('51c4d877-26bc-4077-8ba8-c3484f8765a6', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.1', '2.4', 'CM-30, Incluindo Bonificação', '%', 5181.22, 0.0000, 0.00, true, 21, '2026-08-02 14:01:20.085382+00'),
	('82bd61e3-0825-4595-bea6-3b980162fc86', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.2', '2.4', 'Emulsão RR-1C, Incluindo Bonificação', '%', 2721.84, 0.0000, 0.00, true, 22, '2026-08-02 14:01:20.085382+00'),
	('4feb62e6-d057-45ef-b355-18359ab6d78d', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.3', '2.4', 'CAP-50/70, Incluindo Bonificação', '%', 23345.08, 0.0000, 0.00, true, 23, '2026-08-02 14:01:20.085382+00'),
	('63a353d8-10fd-4a87-ab1a-9640e8dd9339', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.4', '2.4', 'Transporte CM-30', '%', 247.20, 0.0000, 0.00, true, 24, '2026-08-02 14:01:20.085382+00'),
	('0c465d03-4012-4947-92d4-8e74acd2b2da', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.5', '2.4', 'Transporte RR-1C', '%', 214.07, 0.0000, 0.00, true, 25, '2026-08-02 14:01:20.085382+00'),
	('5d4cb5f0-4ac7-4eab-b74f-203f6bfdff0c', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.6', '2.4', 'Transporte CAP 50/70', '%', 1405.79, 0.0000, 0.00, true, 26, '2026-08-02 14:01:20.085382+00'),
	('57a27476-8ded-4bc3-9b1d-69194356c64e', '0245894a-e335-4847-bfe2-55ea47439837', '2.5', '2', 'OBRAS COMPLEMENTARES', 'NaN', 0.00, 0.0000, 664910.32, false, 27, '2026-08-02 14:01:20.085382+00'),
	('5915e35b-1df7-4b6e-9b98-49311d709d89', '0245894a-e335-4847-bfe2-55ea47439837', '2.5.1', '2.5', 'Obras Complementares', 'hm', 11543.58, 57.6000, 664910.32, true, 28, '2026-08-02 14:01:20.085382+00'),
	('ed34da51-d8b8-482b-af84-03d5344f8d2f', '0245894a-e335-4847-bfe2-55ea47439837', '2.6', '2', 'SINALIZAÇÃO', 'NaN', 0.00, 0.0000, 788873.65, false, 29, '2026-08-02 14:01:20.085382+00'),
	('a1361d6a-2465-47fe-bb4d-265b733540a9', '0245894a-e335-4847-bfe2-55ea47439837', '2.6.1', '2.6', 'Sinalização Provisória (fase de obras)', 'mês', 10243.46, 16.0000, 163895.45, true, 30, '2026-08-02 14:01:20.085382+00'),
	('a9fc8d3d-1e92-4b95-b5ba-d7868bacf501', '0245894a-e335-4847-bfe2-55ea47439837', '2.6.2', '2.6', 'Sinalização Definitiva', 'hm', 10850.32, 57.6000, 624978.20, true, 31, '2026-08-02 14:01:20.085382+00'),
	('a150ca1a-8017-40b4-bee0-96998098ee2a', '0245894a-e335-4847-bfe2-55ea47439837', '2.7', '2', 'SERVIÇOS AMBIENTAIS', 'NaN', 0.00, 0.0000, 6533079.07, false, 32, '2026-08-02 14:01:20.085382+00'),
	('260011f4-e50a-495a-803d-0569ed0ce616', '0245894a-e335-4847-bfe2-55ea47439837', '2.7.1', '2.7', 'Serviços Ambientais', 'hm', 113421.52, 57.6000, 6533079.07, true, 33, '2026-08-02 14:01:20.085382+00'),
	('eeb83c50-a052-4ca0-b385-da7f17a25181', '0245894a-e335-4847-bfe2-55ea47439837', '2.8', '2', 'INSTALAÇÃO DE CANTEIRO DE OBRAS, MOBILIZAÇÃO E DESMOBILIZAÇÃO DE
EQUIPAMENTOS', 'NaN', 0.00, 0.0000, 1009775.85, false, 34, '2026-08-02 14:01:20.085382+00'),
	('c4fe06a8-8e0d-4a45-82a7-f947d4c74e8e', '0245894a-e335-4847-bfe2-55ea47439837', '2.8.1', '2.8', 'Instalação do Canteiro de Obras', 'ud', 828016.20, 1.0000, 828016.20, true, 35, '2026-08-02 14:01:20.085382+00'),
	('b8acd424-12a3-497a-af19-e62fd8338ec1', '0245894a-e335-4847-bfe2-55ea47439837', '2.8.2', '2.8', 'Mobilização e Desmobilização de Equipamentos', 'ud', 181759.65, 1.0000, 181759.65, true, 36, '2026-08-02 14:01:20.085382+00'),
	('0b378911-e26b-47f3-8f03-257f6d558f70', '0245894a-e335-4847-bfe2-55ea47439837', '2.9', '2', 'ADMINISTRAÇÃO LOCAL', 'NaN', 0.00, 0.0000, 1601470.54, false, 37, '2026-08-02 14:01:20.085382+00'),
	('6c5469f2-d982-42d5-99b2-4d864479a272', '0245894a-e335-4847-bfe2-55ea47439837', '2.9.1', '2.9', 'Administração Local', 'vb', 1601470.54, 1.0000, 1601470.54, true, 38, '2026-08-02 14:01:20.085382+00'),
	('6d100179-b560-4b6a-8f1f-bf564d85ca78', '0245894a-e335-4847-bfe2-55ea47439837', '2.4 (Dup 1)', '2', 'LIGANTES BETUMINOSOS (PARA CORREÇÃO)', 'NaN', 0.00, 0.0000, 2710631.20, false, 39, '2026-08-02 14:01:20.085382+00'),
	('a9c6b7e2-55d6-41e0-a3c4-6fcc522e2622', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.1 (Dup 1)', '2.4 (Dup 1)', 'CM-30, Incluindo Bonificação', '%', 449446.76, 1.0000, 449446.76, true, 40, '2026-08-02 14:01:20.085382+00'),
	('b91ad24a-b459-4574-bc51-63b8736d0974', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.2 (Dup 1)', '2.4 (Dup 1)', 'Emulsão RR-1C, Incluindo Bonificação', '%', 236107.27, 1.0000, 236107.27, true, 41, '2026-08-02 14:01:20.085382+00'),
	('15d38189-e543-48cf-aaa4-bfdcb9957606', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.3 (Dup 1)', '2.4 (Dup 1)', 'CAP-50/70, Incluindo Bonificação', '%', 2025077.17, 1.0000, 2025077.17, true, 42, '2026-08-02 14:01:20.085382+00'),
	('812a7232-767f-41ca-a027-c89dcb017610', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.3.1', '2.4.3 (Dup 1)', 'BONIFICAÇÃO DE 15,28% SOBRE LIGANTES BETUMINOSOS', 'NaN', 0.00, 0.0000, 414184.45, false, 43, '2026-08-02 14:01:20.085382+00'),
	('4ab381b6-8f62-4a1a-acf4-9f62c97f36ba', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.3.1.1', '2.4.3.1', 'Bonificação de 15,28% sobre ligantes betuminosos', '%', 835268.04, 15.2800, 414184.45, true, 44, '2026-08-02 14:01:20.085382+00'),
	('2b1c5c3e-f4b7-41fe-bedb-79fe6a6b4051', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.4 (Dup 1)', '2.4 (Dup 1)', 'TRANSPORTE DE LIGANTES BETUMINOSOS', 'NaN', 0.00, 0.0000, 186707.63, false, 45, '2026-08-02 14:01:20.085382+00'),
	('ed422e96-cb6a-4543-8b28-d44db046c0e8', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.4 (Dup 2)', '2.4 (Dup 1)', 'Transporte CM-30', '%', 24720.80, 1.0000, 24720.80, true, 46, '2026-08-02 14:01:20.085382+00'),
	('0b1a3f1a-b4b5-4a63-86bb-38de6b0fc6c8', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.5 (Dup 1)', '2.4 (Dup 1)', 'Transporte RR-1C', '%', 21407.47, 1.0000, 21407.47, true, 47, '2026-08-02 14:01:20.085382+00'),
	('2c66240a-3069-4bcc-b533-344f22f25a58', '0245894a-e335-4847-bfe2-55ea47439837', '2.4.6 (Dup 1)', '2.4 (Dup 1)', 'Transporte CAP 50/70', '%', 140579.36, 1.0000, 140579.36, true, 48, '2026-08-02 14:01:20.085382+00');


--
-- Data for Name: medicoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."medicoes" ("id", "projeto_id", "numero_medicao", "data_medicao", "periodo_inicio", "periodo_fim", "status", "created_at") VALUES
	('dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '0245894a-e335-4847-bfe2-55ea47439837', 1, '2026-08-02', '2026-07-01', '2026-07-31', 'APROVADO', '2026-08-02 14:01:20.085382+00');


--
-- Data for Name: itens_medicao_detalhe; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."itens_medicao_detalhe" ("id", "medicao_id", "item_eap_id", "quantidade_periodo", "valor_periodo", "quantidade_acumulada", "valor_acumulado", "percentual_executado_acumulado", "created_at") VALUES
	('ae7e4077-548c-423e-a5c2-79eee1f55d27', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '79ec2937-e1d9-4b6f-b5c7-25b085d13209', 0.0000, 0.00, 1.0000, 219373.69, 100.0000, '2026-08-02 14:01:20.085382+00'),
	('6b3cd9b3-6334-4e02-b4da-1dfa97d87617', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'f945ba13-e94c-4ec5-89fb-9f557a2caff0', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('f7390f81-de9f-47fa-ae44-acb82f215391', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '30ae7928-4484-44ad-98d0-29fb4405722d', 0.0000, 0.00, 57.6000, 2597715.64, 100.0000, '2026-08-02 14:01:20.085382+00'),
	('f9466506-30c4-4f65-883b-69b3843d13dc', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'd7963e3f-56b1-4dce-b4e6-bd1d579e12f8', 0.0000, 0.00, 57.6000, 6737671.29, 100.0000, '2026-08-02 14:01:20.085382+00'),
	('8ffe0652-f2aa-4541-9fcc-9592c6482290', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'b1b3d805-5e1e-4c86-8290-88317b512b3e', 2.0000, 105106.58, 56.0000, 2942984.24, 97.2222, '2026-08-02 14:01:20.085382+00'),
	('5f4993c6-55bd-4d8a-81ac-d4f8d32ddc43', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '2b821845-fb7f-4fc7-aca9-2bf5cd9b5579', 1.0000, 23759.07, 56.8000, 1349515.17, 98.6111, '2026-08-02 14:01:20.085382+00'),
	('f05ded8a-2df2-4025-9442-09f532e6227d', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '438b8385-2b73-41bb-869c-4b5808385df7', 1.0000, 34569.61, 56.8000, 1963553.84, 98.6111, '2026-08-02 14:01:20.085382+00'),
	('ff1d1f62-6b5d-4692-bdc4-910cff1a8596', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'b63cbbc9-1362-4d2c-a600-67455b3d1874', 1.0000, 34869.50, 56.8000, 1980587.60, 98.6111, '2026-08-02 14:01:20.085382+00'),
	('39ca32f9-0c3a-446c-9319-01b51983732f', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '30193f20-4b24-454a-b228-9cc83b97728c', 1.0000, 1840.75, 56.0000, 103082.00, 97.2222, '2026-08-02 14:01:20.085382+00'),
	('037e17bc-62a3-4e24-99b6-c52e46887db7', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '3192b505-f7fc-48e6-bd7a-545e2379b135', 1.0000, 19277.81, 56.0000, 1079557.92, 97.2222, '2026-08-02 14:01:20.085382+00'),
	('7599ccba-f1a1-4a86-9354-eac43aa15b09', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '9e4de7ba-650d-4ed1-8756-e2e88d6efa5c', 3.0000, 16730.11, 55.0000, 306718.50, 95.4861, '2026-08-02 14:01:20.085382+00'),
	('fe0408e6-4150-485e-8948-b2f6addaa3c9', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '03afecc6-c088-4e15-97ca-1a2ca5de4a64', 2.0000, 995.70, 55.5000, 27630.67, 96.3542, '2026-08-02 14:01:20.085382+00'),
	('12a442e3-1d7c-4e73-b8bc-b859c2482b97', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '51c4d877-26bc-4077-8ba8-c3484f8765a6', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('f1f26130-896b-4eb6-912d-f9dc2ce07519', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '82bd61e3-0825-4595-bea6-3b980162fc86', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('5f3e34bd-0476-41e4-b48a-85ac5aa79826', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '4feb62e6-d057-45ef-b355-18359ab6d78d', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('6337efcf-ab42-4a6e-99a7-d1b0dfcc4168', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '63a353d8-10fd-4a87-ab1a-9640e8dd9339', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('bae59665-4932-4b96-9d93-9bfd06f3af62', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '0c465d03-4012-4947-92d4-8e74acd2b2da', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('44aebbbd-30f9-4bc0-bb20-62a9847f8601', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '5d4cb5f0-4ac7-4eab-b74f-203f6bfdff0c', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('af38fc10-8c3b-48d4-8dd4-0385fa6eabdf', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '5915e35b-1df7-4b6e-9b98-49311d709d89', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('fec19668-2b47-4dbf-b5d6-aaeb67c71140', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'a1361d6a-2465-47fe-bb4d-265b733540a9', 1.0000, 10243.46, 13.0000, 133164.98, 81.2500, '2026-08-02 14:01:20.085382+00'),
	('f76c2308-be7e-48f1-8cd9-1c026a9d71a8', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'a9fc8d3d-1e92-4b95-b5ba-d7868bacf501', 0.0000, 0.00, 0.0000, 0.00, 0.0000, '2026-08-02 14:01:20.085382+00'),
	('9375be08-0780-4265-b9e6-6b92a4f339a2', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '260011f4-e50a-495a-803d-0569ed0ce616', 2.8000, 317580.25, 50.4800, 5725518.32, 87.6389, '2026-08-02 14:01:20.085382+00'),
	('71faf9db-3a60-4f7c-9eb8-6dcef18c5e0a', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'c4fe06a8-8e0d-4a45-82a7-f947d4c74e8e', 0.0000, 0.00, 1.0000, 828016.20, 100.0000, '2026-08-02 14:01:20.085382+00'),
	('3aeb4d5f-50ae-4535-b03d-36d8d03ec9bc', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'b8acd424-12a3-497a-af19-e62fd8338ec1', 0.0000, 0.00, 0.5000, 90879.82, 50.0000, '2026-08-02 14:01:20.085382+00'),
	('769cd548-f2cc-4961-a83c-49e1967b0d46', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '6c5469f2-d982-42d5-99b2-4d864479a272', 0.0210, 32029.41, 0.9110, 1458939.66, 91.1000, '2026-08-02 14:01:20.085382+00'),
	('f26b27aa-fe6c-4028-8a40-2694f3faccd5', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'a9c6b7e2-55d6-41e0-a3c4-6fcc522e2622', 0.0180, 8090.05, 0.9720, 436862.25, 97.2000, '2026-08-02 14:01:20.085382+00'),
	('8c855e21-6abc-4cc9-9a2b-b152a2bf1c33', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'b91ad24a-b459-4574-bc51-63b8736d0974', 0.0350, 8263.75, 0.9640, 227607.40, 96.4000, '2026-08-02 14:01:20.085382+00'),
	('f82a7aa5-4a4b-445f-8714-7ebefe7da714', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '15d38189-e543-48cf-aaa4-bfdcb9957606', 0.0350, 70877.70, 0.9640, 1952174.39, 96.4000, '2026-08-02 14:01:20.085382+00'),
	('578e3caa-25fe-4bfc-a953-d5dd436358ff', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '4ab381b6-8f62-4a1a-acf4-9f62c97f36ba', 0.0000, 13328.98, 15.2800, 399823.21, 100.0000, '2026-08-02 14:01:20.085382+00'),
	('7d63bf2b-7dd5-4bf4-b66a-0435eb801611', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', 'ed422e96-cb6a-4543-8b28-d44db046c0e8', 0.0180, 444.97, 0.9720, 24028.61, 97.2000, '2026-08-02 14:01:20.085382+00'),
	('ff28ed6c-c555-47fd-86c8-4aaab2f0e5ca', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '0b1a3f1a-b4b5-4a63-86bb-38de6b0fc6c8', 0.0350, 749.27, 0.9640, 20636.80, 96.4000, '2026-08-02 14:01:20.085382+00'),
	('16880fa9-2374-4c38-964f-a318de2970ed', 'dd47fb9e-3a17-41db-8f58-d5d0fb38264d', '2c66240a-3069-4bcc-b533-344f22f25a58', 0.0350, 4920.28, 0.9640, 135518.50, 96.4000, '2026-08-02 14:01:20.085382+00');


--
-- Data for Name: perfis_permissoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."perfis_permissoes" ("id", "contrato_id", "perfil", "pode_ver_dre", "pode_editar_pagamento", "pode_aprovar_medicao", "pode_cadastrar_empresa", "pode_exportar_relatorio", "pode_gerenciar_usuarios", "created_at", "updated_at") VALUES
	('14f74a90-b88f-4b35-bb42-26a67e8e45a7', 'CTR-2026-SYS', 'ADMIN', true, true, true, true, true, true, '2026-08-02 13:49:47.767202+00', '2026-08-02 13:49:47.767202+00'),
	('f5702a1e-1357-4186-8ad1-43044c828c54', 'CTR-2026-SYS', 'GESTOR', true, true, true, false, true, false, '2026-08-02 13:49:47.767202+00', '2026-08-02 13:49:47.767202+00'),
	('d65e422f-28aa-4088-b419-8b9ae3661f81', 'CTR-2026-SYS', 'FINANCEIRO', true, true, false, true, true, false, '2026-08-02 13:49:47.767202+00', '2026-08-02 13:49:47.767202+00'),
	('1bee736a-3b6a-4af0-8161-72bbd46382d6', 'CTR-2026-SYS', 'FORNECEDOR', false, false, false, false, false, false, '2026-08-02 13:49:47.767202+00', '2026-08-02 13:49:47.767202+00');


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."usuarios" ("uid", "email", "nome", "foto_url", "contrato_id", "perfil", "status", "created_at", "updated_at") VALUES
	('3G1JNHecTNNTimjaxkUxxTfb9qY2', 'sagacitas.sistemas@gmail.com', 'sagacitas sistemas', 'https://lh3.googleusercontent.com/a/ACg8ocJ4tp3ng2WpUHYXgot3Iee97F91S5LPPw1woaZ9QJwsQe6umgE=s96-c', 'CTR-2026-SYS', 'ADMIN', 'ATIVO', '2026-08-02 13:49:47.811015+00', '2026-08-02 13:49:47.811015+00');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict Miv7PxN5cvDkxsLc9HL8Bon35nfSD2l0p9TFMX2sPGL0xYbWYLYMpi6laKd2j1G

RESET ALL;
