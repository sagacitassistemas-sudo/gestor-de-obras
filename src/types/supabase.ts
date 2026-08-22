export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          cod_evento: string
          contrato_id: string
          criado_em: string | null
          descricao: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          ip_origem: string | null
          usuario_email: string | null
          usuario_uid: string | null
        }
        Insert: {
          cod_evento: string
          contrato_id: string
          criado_em?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          ip_origem?: string | null
          usuario_email?: string | null
          usuario_uid?: string | null
        }
        Update: {
          cod_evento?: string
          contrato_id?: string
          criado_em?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          ip_origem?: string | null
          usuario_email?: string | null
          usuario_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_cod_evento_fkey"
            columns: ["cod_evento"]
            isOneToOne: false
            referencedRelation: "sistema_eventos_catalogo"
            referencedColumns: ["cod_evento"]
          },
        ]
      }
      avaliacao_itens: {
        Row: {
          avaliacao_id: string
          competencia_id: string
          id: string
          nota_alcancada: number | null
          observacao: string | null
        }
        Insert: {
          avaliacao_id: string
          competencia_id: string
          id?: string
          nota_alcancada?: number | null
          observacao?: string | null
        }
        Update: {
          avaliacao_id?: string
          competencia_id?: string
          id?: string
          nota_alcancada?: number | null
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_itens_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_desempenho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_itens_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_desempenho: {
        Row: {
          avaliador_uid: string
          created_at: string | null
          data_avaliacao: string
          funcionario_id: string
          id: string
          observacao_geral: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          avaliador_uid: string
          created_at?: string | null
          data_avaliacao?: string
          funcionario_id: string
          id?: string
          observacao_geral?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          avaliador_uid?: string
          created_at?: string | null
          data_avaliacao?: string
          funcionario_id?: string
          id?: string
          observacao_geral?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_desempenho_avaliador_uid_fkey"
            columns: ["avaliador_uid"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "avaliacoes_desempenho_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_desempenho_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      calendario_excecoes: {
        Row: {
          calendario_id: string
          carga_horaria: number | null
          created_at: string | null
          data_excecao: string
          descricao: string
          id: string
          tipo: string
        }
        Insert: {
          calendario_id: string
          carga_horaria?: number | null
          created_at?: string | null
          data_excecao: string
          descricao: string
          id?: string
          tipo?: string
        }
        Update: {
          calendario_id?: string
          carga_horaria?: number | null
          created_at?: string | null
          data_excecao?: string
          descricao?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendario_excecoes_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "calendarios"
            referencedColumns: ["id"]
          },
        ]
      }
      calendarios: {
        Row: {
          carga_dom: number | null
          carga_qua: number | null
          carga_qui: number | null
          carga_sab: number | null
          carga_seg: number | null
          carga_sex: number | null
          carga_ter: number | null
          created_at: string | null
          id: string
          nome: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          carga_dom?: number | null
          carga_qua?: number | null
          carga_qui?: number | null
          carga_sab?: number | null
          carga_seg?: number | null
          carga_sex?: number | null
          carga_ter?: number | null
          created_at?: string | null
          id?: string
          nome: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          carga_dom?: number | null
          carga_qua?: number | null
          carga_qui?: number | null
          carga_sab?: number | null
          carga_seg?: number | null
          carga_sex?: number | null
          carga_ter?: number | null
          created_at?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cessoes_pessoal: {
        Row: {
          autorizado_por: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          equipe_destino_id: string
          equipe_origem_id: string
          funcionario_id: string
          id: string
          motivo: string | null
          os_destino_id: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          autorizado_por?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          equipe_destino_id: string
          equipe_origem_id: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          os_destino_id?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          autorizado_por?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          equipe_destino_id?: string
          equipe_origem_id?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          os_destino_id?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cessoes_pessoal_equipe_destino_id_fkey"
            columns: ["equipe_destino_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cessoes_pessoal_equipe_origem_id_fkey"
            columns: ["equipe_origem_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cessoes_pessoal_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cessoes_pessoal_os_destino_id_fkey"
            columns: ["os_destino_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cessoes_pessoal_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      competencias_catalogo: {
        Row: {
          created_at: string | null
          descricao: string
          eixo: string
          especialidade_id: string
          id: string
          peso_esperado: number | null
          tenant_id: string
          treinamento_obrigatorio: string | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          eixo: string
          especialidade_id: string
          id?: string
          peso_esperado?: number | null
          tenant_id: string
          treinamento_obrigatorio?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          eixo?: string
          especialidade_id?: string
          id?: string
          peso_esperado?: number | null
          tenant_id?: string
          treinamento_obrigatorio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competencias_catalogo_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencias_catalogo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      contratos_obra: {
        Row: {
          created_at: string | null
          data_assinatura: string | null
          data_vigencia: string | null
          fornecedor_id: string
          id: string
          numero_contrato: string
          objeto: string | null
          projeto_id: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          valor_global: number | null
        }
        Insert: {
          created_at?: string | null
          data_assinatura?: string | null
          data_vigencia?: string | null
          fornecedor_id: string
          id?: string
          numero_contrato: string
          objeto?: string | null
          projeto_id: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          valor_global?: number | null
        }
        Update: {
          created_at?: string | null
          data_assinatura?: string | null
          data_vigencia?: string | null
          fornecedor_id?: string
          id?: string
          numero_contrato?: string
          objeto?: string | null
          projeto_id?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          valor_global?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_obra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "contratos_obra_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "fk_contrato_fornecedor"
            columns: ["fornecedor_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas_fornecedores"
            referencedColumns: ["id", "contrato_id"]
          },
        ]
      }
      convites: {
        Row: {
          contrato_id: string | null
          created_at: string
          email: string
          empresa_id: string | null
          entidade_id: string | null
          expires_at: string | null
          perfil: string
          status: string
          token: string
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          entidade_id?: string | null
          expires_at?: string | null
          perfil: string
          status?: string
          token?: string
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          entidade_id?: string | null
          expires_at?: string | null
          perfil?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      cronograma_financeiro_semanas: {
        Row: {
          created_at: string | null
          eap_codigo: string
          id: string
          item_eap_id: string
          projeto_id: string
          semana_fim: string
          semana_inicio: string
          updated_at: string | null
          valor_planejado: number | null
          valor_realizado: number | null
        }
        Insert: {
          created_at?: string | null
          eap_codigo: string
          id?: string
          item_eap_id: string
          projeto_id: string
          semana_fim: string
          semana_inicio: string
          updated_at?: string | null
          valor_planejado?: number | null
          valor_realizado?: number | null
        }
        Update: {
          created_at?: string | null
          eap_codigo?: string
          id?: string
          item_eap_id?: string
          projeto_id?: string
          semana_fim?: string
          semana_inicio?: string
          updated_at?: string | null
          valor_planejado?: number | null
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_financeiro_semanas_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "itens_eap"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_financeiro_semanas_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_eap_medicao"
            referencedColumns: ["item_eap_id"]
          },
          {
            foreignKeyName: "cronograma_financeiro_semanas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_financeiro_semanas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      cronograma_fisico_financeiro_mensal: {
        Row: {
          created_at: string | null
          etapa_orcamento_id: number
          id: number
          mes_ano: string
          percentual_fisico_previsto: number | null
          percentual_fisico_realizado: number | null
          valor_financeiro_previsto: number | null
          valor_financeiro_realizado: number | null
        }
        Insert: {
          created_at?: string | null
          etapa_orcamento_id: number
          id?: number
          mes_ano: string
          percentual_fisico_previsto?: number | null
          percentual_fisico_realizado?: number | null
          valor_financeiro_previsto?: number | null
          valor_financeiro_realizado?: number | null
        }
        Update: {
          created_at?: string | null
          etapa_orcamento_id?: number
          id?: number
          mes_ano?: string
          percentual_fisico_previsto?: number | null
          percentual_fisico_realizado?: number | null
          valor_financeiro_previsto?: number | null
          valor_financeiro_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_fisico_financeiro_mensal_etapa_orcamento_id_fkey"
            columns: ["etapa_orcamento_id"]
            isOneToOne: false
            referencedRelation: "etapas_orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_versions: {
        Row: {
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          projeto_id: string
          versao: number
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          projeto_id: string
          versao: number
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          projeto_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "cronograma_versions_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_versions_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      dispositivos_mobile: {
        Row: {
          created_at: string | null
          device_id: string
          funcionario_id: string | null
          id: string
          last_login: string | null
          modelo: string | null
          os_version: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          funcionario_id?: string | null
          id?: string
          last_login?: string | null
          modelo?: string | null
          os_version?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          funcionario_id?: string | null
          id?: string
          last_login?: string | null
          modelo?: string | null
          os_version?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_mobile_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_mobile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      empresa_contratante: {
        Row: {
          area: string | null
          cnpj: string | null
          contrato_id: string
          created_at: string | null
          departamento: string | null
          email: string | null
          gestor_responsavel: string | null
          natureza: string | null
          nome: string
          telefone: string | null
          unidade_administrativa: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          cnpj?: string | null
          contrato_id: string
          created_at?: string | null
          departamento?: string | null
          email?: string | null
          gestor_responsavel?: string | null
          natureza?: string | null
          nome: string
          telefone?: string | null
          unidade_administrativa?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          cnpj?: string | null
          contrato_id?: string
          created_at?: string | null
          departamento?: string | null
          email?: string | null
          gestor_responsavel?: string | null
          natureza?: string | null
          nome?: string
          telefone?: string | null
          unidade_administrativa?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      empresas_fornecedores: {
        Row: {
          cnpj_cpf: string
          contrato_id: string
          created_at: string | null
          detalhes: Json | null
          email_contato: string | null
          id: string
          nome: string
          status: string | null
          telefone: string | null
          tipo: string | null
          total_faturado: number | null
        }
        Insert: {
          cnpj_cpf: string
          contrato_id: string
          created_at?: string | null
          detalhes?: Json | null
          email_contato?: string | null
          id: string
          nome: string
          status?: string | null
          telefone?: string | null
          tipo?: string | null
          total_faturado?: number | null
        }
        Update: {
          cnpj_cpf?: string
          contrato_id?: string
          created_at?: string | null
          detalhes?: Json | null
          email_contato?: string | null
          id?: string
          nome?: string
          status?: string | null
          telefone?: string | null
          tipo?: string | null
          total_faturado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_fornecedores_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      equipe_composicao_especialidades: {
        Row: {
          created_at: string | null
          equipe_id: string
          especialidade_id: string
          id: string
          os_id: string | null
          quantidade: number
          tenant_id: string
          updated_at: string | null
          valor_hora_projetado: number | null
        }
        Insert: {
          created_at?: string | null
          equipe_id: string
          especialidade_id: string
          id?: string
          os_id?: string | null
          quantidade?: number
          tenant_id: string
          updated_at?: string | null
          valor_hora_projetado?: number | null
        }
        Update: {
          created_at?: string | null
          equipe_id?: string
          especialidade_id?: string
          id?: string
          os_id?: string | null
          quantidade?: number
          tenant_id?: string
          updated_at?: string | null
          valor_hora_projetado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_composicao_especialidades_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_composicao_especialidades_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_composicao_especialidades_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_composicao_especialidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      equipe_membros: {
        Row: {
          adicionado_em: string | null
          equipe_id: string
          funcao_na_equipe: string | null
          funcionario_id: string
          id: string
        }
        Insert: {
          adicionado_em?: string | null
          equipe_id: string
          funcao_na_equipe?: string | null
          funcionario_id: string
          id?: string
        }
        Update: {
          adicionado_em?: string | null
          equipe_id?: string
          funcao_na_equipe?: string | null
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          contrato_id: string
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          lider_id: string | null
          nome: string
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          lider_id?: string | null
          nome: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          lider_id?: string | null
          nome?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipes_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "fk_equipe_empresa"
            columns: ["empresa_id", "contrato_id"]
            isOneToOne: false
            referencedRelation: "empresas_fornecedores"
            referencedColumns: ["id", "contrato_id"]
          },
        ]
      }
      especialidades: {
        Row: {
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          valor_hora: number | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          valor_hora?: number | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          valor_hora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "especialidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      etapas_orcamento: {
        Row: {
          codigo_etapa: string
          created_at: string | null
          id: number
          nome_etapa: string
          pct_equipamentos: number | null
          pct_mao_de_obra: number | null
          pct_materiais: number | null
          peso_percentual: number | null
          projeto_id: string
          valor_total_etapa: number | null
        }
        Insert: {
          codigo_etapa: string
          created_at?: string | null
          id?: number
          nome_etapa: string
          pct_equipamentos?: number | null
          pct_mao_de_obra?: number | null
          pct_materiais?: number | null
          peso_percentual?: number | null
          projeto_id: string
          valor_total_etapa?: number | null
        }
        Update: {
          codigo_etapa?: string
          created_at?: string | null
          id?: number
          nome_etapa?: string
          pct_equipamentos?: number | null
          pct_mao_de_obra?: number | null
          pct_materiais?: number | null
          peso_percentual?: number | null
          projeto_id?: string
          valor_total_etapa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etapas_orcamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapas_orcamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      funcionario_treinamentos: {
        Row: {
          certificado_url: string | null
          created_at: string | null
          data_conclusao: string
          data_vencimento: string
          funcionario_id: string
          id: string
          nome_curso: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao: string
          data_vencimento: string
          funcionario_id: string
          id?: string
          nome_curso: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string
          data_vencimento?: string
          funcionario_id?: string
          id?: string
          nome_curso?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_treinamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          cargo: string | null
          contrato_id: string
          cpf: string | null
          created_at: string | null
          data_admissao: string | null
          email: string | null
          empresa_id: string
          especialidade_id: string | null
          foto_url: string | null
          id: string
          nome: string
          status: string | null
          telefone: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          contrato_id: string
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          email?: string | null
          empresa_id: string
          especialidade_id?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          status?: string | null
          telefone?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          contrato_id?: string
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          email?: string | null
          empresa_id?: string
          especialidade_id?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          status?: string | null
          telefone?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_func_empresa"
            columns: ["empresa_id", "contrato_id"]
            isOneToOne: false
            referencedRelation: "empresas_fornecedores"
            referencedColumns: ["id", "contrato_id"]
          },
          {
            foreignKeyName: "funcionarios_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      itens_eap: {
        Row: {
          created_at: string | null
          data_execucao: string | null
          data_fim: string | null
          data_fim_financeiro: string | null
          data_inicio: string | null
          data_inicio_financeiro: string | null
          descricao_servico: string
          duracao_dias: number | null
          e_analitico: boolean
          eap_codigo: string
          eap_pai_codigo: string | null
          id: string
          ordem: number
          percentual_executado_financeiro: number | null
          preco_unitario: number | null
          predecessores: Json | null
          projeto_id: string
          quantidade_contratada: number | null
          unidade_medida: string | null
          valor_desembolsado: number | null
          valor_total_contratado: number | null
        }
        Insert: {
          created_at?: string | null
          data_execucao?: string | null
          data_fim?: string | null
          data_fim_financeiro?: string | null
          data_inicio?: string | null
          data_inicio_financeiro?: string | null
          descricao_servico: string
          duracao_dias?: number | null
          e_analitico?: boolean
          eap_codigo: string
          eap_pai_codigo?: string | null
          id?: string
          ordem?: number
          percentual_executado_financeiro?: number | null
          preco_unitario?: number | null
          predecessores?: Json | null
          projeto_id: string
          quantidade_contratada?: number | null
          unidade_medida?: string | null
          valor_desembolsado?: number | null
          valor_total_contratado?: number | null
        }
        Update: {
          created_at?: string | null
          data_execucao?: string | null
          data_fim?: string | null
          data_fim_financeiro?: string | null
          data_inicio?: string | null
          data_inicio_financeiro?: string | null
          descricao_servico?: string
          duracao_dias?: number | null
          e_analitico?: boolean
          eap_codigo?: string
          eap_pai_codigo?: string | null
          id?: string
          ordem?: number
          percentual_executado_financeiro?: number | null
          preco_unitario?: number | null
          predecessores?: Json | null
          projeto_id?: string
          quantidade_contratada?: number | null
          unidade_medida?: string | null
          valor_desembolsado?: number | null
          valor_total_contratado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_eap_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_eap_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      itens_medicao_detalhe: {
        Row: {
          created_at: string | null
          id: string
          item_eap_id: string
          medicao_id: string
          percentual_executado_acumulado: number
          quantidade_acumulada: number
          quantidade_periodo: number
          valor_acumulado: number
          valor_periodo: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_eap_id: string
          medicao_id: string
          percentual_executado_acumulado?: number
          quantidade_acumulada?: number
          quantidade_periodo?: number
          valor_acumulado?: number
          valor_periodo?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_eap_id?: string
          medicao_id?: string
          percentual_executado_acumulado?: number
          quantidade_acumulada?: number
          quantidade_periodo?: number
          valor_acumulado?: number
          valor_periodo?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_medicao_detalhe_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "itens_eap"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_medicao_detalhe_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_eap_medicao"
            referencedColumns: ["item_eap_id"]
          },
          {
            foreignKeyName: "itens_medicao_detalhe_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          contrato_obra_id: string | null
          created_at: string | null
          data_medicao: string
          id: string
          numero_medicao: number
          periodo_fim: string
          periodo_inicio: string
          projeto_id: string
          status: string
        }
        Insert: {
          contrato_obra_id?: string | null
          created_at?: string | null
          data_medicao: string
          id?: string
          numero_medicao: number
          periodo_fim: string
          periodo_inicio: string
          projeto_id: string
          status?: string
        }
        Update: {
          contrato_obra_id?: string | null
          created_at?: string | null
          data_medicao?: string
          id?: string
          numero_medicao?: number
          periodo_fim?: string
          periodo_inicio?: string
          projeto_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_contrato_obra_id_fkey"
            columns: ["contrato_obra_id"]
            isOneToOne: false
            referencedRelation: "contratos_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_contrato_obra_id_fkey"
            columns: ["contrato_obra_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["contrato_obra_id"]
          },
          {
            foreignKeyName: "medicoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          composicao_simulada: Json | null
          created_at: string | null
          custo_aprovado_snapshot_jsonb: Json | null
          data_emissao: string
          data_inicio_confirmada: string | null
          descricao: string | null
          equipamentos: string | null
          equipe_id: string | null
          ferramentas: string | null
          id: string
          item_eap_id: string
          materiais: string | null
          numero_os: string
          projeto_id: string
          responsavel_rdo_id: string | null
          snapshot_custos: Json | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          valor_equipamentos: number | null
          valor_ferramentas: number | null
          valor_mao_obra: number | null
          valor_materiais: number | null
        }
        Insert: {
          composicao_simulada?: Json | null
          created_at?: string | null
          custo_aprovado_snapshot_jsonb?: Json | null
          data_emissao?: string
          data_inicio_confirmada?: string | null
          descricao?: string | null
          equipamentos?: string | null
          equipe_id?: string | null
          ferramentas?: string | null
          id?: string
          item_eap_id: string
          materiais?: string | null
          numero_os: string
          projeto_id: string
          responsavel_rdo_id?: string | null
          snapshot_custos?: Json | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          valor_equipamentos?: number | null
          valor_ferramentas?: number | null
          valor_mao_obra?: number | null
          valor_materiais?: number | null
        }
        Update: {
          composicao_simulada?: Json | null
          created_at?: string | null
          custo_aprovado_snapshot_jsonb?: Json | null
          data_emissao?: string
          data_inicio_confirmada?: string | null
          descricao?: string | null
          equipamentos?: string | null
          equipe_id?: string | null
          ferramentas?: string | null
          id?: string
          item_eap_id?: string
          materiais?: string | null
          numero_os?: string
          projeto_id?: string
          responsavel_rdo_id?: string | null
          snapshot_custos?: Json | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          valor_equipamentos?: number | null
          valor_ferramentas?: number | null
          valor_mao_obra?: number | null
          valor_materiais?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "itens_eap"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_eap_medicao"
            referencedColumns: ["item_eap_id"]
          },
          {
            foreignKeyName: "ordens_servico_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "ordens_servico_responsavel_rdo_id_fkey"
            columns: ["responsavel_rdo_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      os_aprovacoes_compliance: {
        Row: {
          aprovador_email: string
          data_aprovacao: string | null
          id: string
          metadata_seguranca: Json | null
          ordem_servico_id: string
          snapshot_congelado: Json
          tenant_id: string
        }
        Insert: {
          aprovador_email: string
          data_aprovacao?: string | null
          id?: string
          metadata_seguranca?: Json | null
          ordem_servico_id: string
          snapshot_congelado: Json
          tenant_id: string
        }
        Update: {
          aprovador_email?: string
          data_aprovacao?: string | null
          id?: string
          metadata_seguranca?: Json | null
          ordem_servico_id?: string
          snapshot_congelado?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_aprovacoes_compliance_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: true
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_execucao: {
        Row: {
          created_at: string | null
          data_fim_estimada: string | null
          data_inicio_estimada: string | null
          duracao_calculada_dias: number | null
          etapa_orcamento_id: number
          hh_unitario: number | null
          id: number
          quantidade_total: number | null
          tamanho_equipe_padrao: number | null
          unidade_medida: string | null
        }
        Insert: {
          created_at?: string | null
          data_fim_estimada?: string | null
          data_inicio_estimada?: string | null
          duracao_calculada_dias?: number | null
          etapa_orcamento_id: number
          hh_unitario?: number | null
          id?: number
          quantidade_total?: number | null
          tamanho_equipe_padrao?: number | null
          unidade_medida?: string | null
        }
        Update: {
          created_at?: string | null
          data_fim_estimada?: string | null
          data_inicio_estimada?: string | null
          duracao_calculada_dias?: number | null
          etapa_orcamento_id?: number
          hh_unitario?: number | null
          id?: number
          quantidade_total?: number | null
          tamanho_equipe_padrao?: number | null
          unidade_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parametros_execucao_etapa_orcamento_id_fkey"
            columns: ["etapa_orcamento_id"]
            isOneToOne: false
            referencedRelation: "etapas_orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_contratante: {
        Row: {
          configuracoes_criar: boolean | null
          configuracoes_editar: boolean | null
          configuracoes_excluir: boolean | null
          configuracoes_ler: boolean | null
          contrato_id: string
          contratos_criar: boolean | null
          contratos_editar: boolean | null
          contratos_excluir: boolean | null
          contratos_ler: boolean | null
          created_at: string | null
          cronogramas_criar: boolean | null
          cronogramas_editar: boolean | null
          cronogramas_excluir: boolean | null
          cronogramas_ler: boolean | null
          empresas_criar: boolean | null
          empresas_editar: boolean | null
          empresas_excluir: boolean | null
          empresas_ler: boolean | null
          entidades_criar: boolean | null
          entidades_editar: boolean | null
          entidades_excluir: boolean | null
          entidades_ler: boolean | null
          financeiro_criar: boolean | null
          financeiro_editar: boolean | null
          financeiro_excluir: boolean | null
          financeiro_ler: boolean | null
          id: string
          medicoes_criar: boolean | null
          medicoes_editar: boolean | null
          medicoes_excluir: boolean | null
          medicoes_ler: boolean | null
          os_criar: boolean | null
          os_editar: boolean | null
          os_excluir: boolean | null
          os_ler: boolean | null
          projetos_criar: boolean | null
          projetos_editar: boolean | null
          projetos_excluir: boolean | null
          projetos_ler: boolean | null
          rdo_criar: boolean | null
          rdo_editar: boolean | null
          rdo_excluir: boolean | null
          rdo_ler: boolean | null
          relatorios_ler: boolean | null
          updated_at: string | null
          usuarios_criar: boolean | null
          usuarios_editar: boolean | null
          usuarios_excluir: boolean | null
          usuarios_ler: boolean | null
        }
        Insert: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Update: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id?: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_contratante_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      permissoes_empresa: {
        Row: {
          configuracoes_criar: boolean | null
          configuracoes_editar: boolean | null
          configuracoes_excluir: boolean | null
          configuracoes_ler: boolean | null
          contrato_id: string
          contratos_criar: boolean | null
          contratos_editar: boolean | null
          contratos_excluir: boolean | null
          contratos_ler: boolean | null
          created_at: string | null
          cronogramas_criar: boolean | null
          cronogramas_editar: boolean | null
          cronogramas_excluir: boolean | null
          cronogramas_ler: boolean | null
          empresa_id: string
          empresas_criar: boolean | null
          empresas_editar: boolean | null
          empresas_excluir: boolean | null
          empresas_ler: boolean | null
          entidades_criar: boolean | null
          entidades_editar: boolean | null
          entidades_excluir: boolean | null
          entidades_ler: boolean | null
          financeiro_criar: boolean | null
          financeiro_editar: boolean | null
          financeiro_excluir: boolean | null
          financeiro_ler: boolean | null
          id: string
          medicoes_criar: boolean | null
          medicoes_editar: boolean | null
          medicoes_excluir: boolean | null
          medicoes_ler: boolean | null
          os_criar: boolean | null
          os_editar: boolean | null
          os_excluir: boolean | null
          os_ler: boolean | null
          projetos_criar: boolean | null
          projetos_editar: boolean | null
          projetos_excluir: boolean | null
          projetos_ler: boolean | null
          rdo_criar: boolean | null
          rdo_editar: boolean | null
          rdo_excluir: boolean | null
          rdo_ler: boolean | null
          relatorios_ler: boolean | null
          updated_at: string | null
          usuarios_criar: boolean | null
          usuarios_editar: boolean | null
          usuarios_excluir: boolean | null
          usuarios_ler: boolean | null
        }
        Insert: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresa_id: string
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Update: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id?: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresa_id?: string
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pe_empresa"
            columns: ["empresa_id", "contrato_id"]
            isOneToOne: false
            referencedRelation: "empresas_fornecedores"
            referencedColumns: ["id", "contrato_id"]
          },
        ]
      }
      permissoes_tipo: {
        Row: {
          configuracoes_criar: boolean | null
          configuracoes_editar: boolean | null
          configuracoes_excluir: boolean | null
          configuracoes_ler: boolean | null
          contrato_id: string
          contratos_criar: boolean | null
          contratos_editar: boolean | null
          contratos_excluir: boolean | null
          contratos_ler: boolean | null
          created_at: string | null
          cronogramas_criar: boolean | null
          cronogramas_editar: boolean | null
          cronogramas_excluir: boolean | null
          cronogramas_ler: boolean | null
          empresas_criar: boolean | null
          empresas_editar: boolean | null
          empresas_excluir: boolean | null
          empresas_ler: boolean | null
          entidades_criar: boolean | null
          entidades_editar: boolean | null
          entidades_excluir: boolean | null
          entidades_ler: boolean | null
          financeiro_criar: boolean | null
          financeiro_editar: boolean | null
          financeiro_excluir: boolean | null
          financeiro_ler: boolean | null
          id: string
          medicoes_criar: boolean | null
          medicoes_editar: boolean | null
          medicoes_excluir: boolean | null
          medicoes_ler: boolean | null
          os_criar: boolean | null
          os_editar: boolean | null
          os_excluir: boolean | null
          os_ler: boolean | null
          perfil: string
          projetos_criar: boolean | null
          projetos_editar: boolean | null
          projetos_excluir: boolean | null
          projetos_ler: boolean | null
          rdo_criar: boolean | null
          rdo_editar: boolean | null
          rdo_excluir: boolean | null
          rdo_ler: boolean | null
          relatorios_ler: boolean | null
          updated_at: string | null
          usuarios_criar: boolean | null
          usuarios_editar: boolean | null
          usuarios_excluir: boolean | null
          usuarios_ler: boolean | null
        }
        Insert: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          perfil: string
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Update: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id?: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          perfil?: string
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_tipo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      permissoes_usuario: {
        Row: {
          configuracoes_criar: boolean | null
          configuracoes_editar: boolean | null
          configuracoes_excluir: boolean | null
          configuracoes_ler: boolean | null
          contrato_id: string
          contratos_criar: boolean | null
          contratos_editar: boolean | null
          contratos_excluir: boolean | null
          contratos_ler: boolean | null
          created_at: string | null
          cronogramas_criar: boolean | null
          cronogramas_editar: boolean | null
          cronogramas_excluir: boolean | null
          cronogramas_ler: boolean | null
          empresa_id: string | null
          empresas_criar: boolean | null
          empresas_editar: boolean | null
          empresas_excluir: boolean | null
          empresas_ler: boolean | null
          entidades_criar: boolean | null
          entidades_editar: boolean | null
          entidades_excluir: boolean | null
          entidades_ler: boolean | null
          financeiro_criar: boolean | null
          financeiro_editar: boolean | null
          financeiro_excluir: boolean | null
          financeiro_ler: boolean | null
          id: string
          medicoes_criar: boolean | null
          medicoes_editar: boolean | null
          medicoes_excluir: boolean | null
          medicoes_ler: boolean | null
          os_criar: boolean | null
          os_editar: boolean | null
          os_excluir: boolean | null
          os_ler: boolean | null
          projetos_criar: boolean | null
          projetos_editar: boolean | null
          projetos_excluir: boolean | null
          projetos_ler: boolean | null
          rdo_criar: boolean | null
          rdo_editar: boolean | null
          rdo_excluir: boolean | null
          rdo_ler: boolean | null
          relatorios_ler: boolean | null
          updated_at: string | null
          usuario_uid: string
          usuarios_criar: boolean | null
          usuarios_editar: boolean | null
          usuarios_excluir: boolean | null
          usuarios_ler: boolean | null
        }
        Insert: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresa_id?: string | null
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuario_uid: string
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Update: {
          configuracoes_criar?: boolean | null
          configuracoes_editar?: boolean | null
          configuracoes_excluir?: boolean | null
          configuracoes_ler?: boolean | null
          contrato_id?: string
          contratos_criar?: boolean | null
          contratos_editar?: boolean | null
          contratos_excluir?: boolean | null
          contratos_ler?: boolean | null
          created_at?: string | null
          cronogramas_criar?: boolean | null
          cronogramas_editar?: boolean | null
          cronogramas_excluir?: boolean | null
          cronogramas_ler?: boolean | null
          empresa_id?: string | null
          empresas_criar?: boolean | null
          empresas_editar?: boolean | null
          empresas_excluir?: boolean | null
          empresas_ler?: boolean | null
          entidades_criar?: boolean | null
          entidades_editar?: boolean | null
          entidades_excluir?: boolean | null
          entidades_ler?: boolean | null
          financeiro_criar?: boolean | null
          financeiro_editar?: boolean | null
          financeiro_excluir?: boolean | null
          financeiro_ler?: boolean | null
          id?: string
          medicoes_criar?: boolean | null
          medicoes_editar?: boolean | null
          medicoes_excluir?: boolean | null
          medicoes_ler?: boolean | null
          os_criar?: boolean | null
          os_editar?: boolean | null
          os_excluir?: boolean | null
          os_ler?: boolean | null
          projetos_criar?: boolean | null
          projetos_editar?: boolean | null
          projetos_excluir?: boolean | null
          projetos_ler?: boolean | null
          rdo_criar?: boolean | null
          rdo_editar?: boolean | null
          rdo_excluir?: boolean | null
          rdo_ler?: boolean | null
          relatorios_ler?: boolean | null
          updated_at?: string | null
          usuario_uid?: string
          usuarios_criar?: boolean | null
          usuarios_editar?: boolean | null
          usuarios_excluir?: boolean | null
          usuarios_ler?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_usuario_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "permissoes_usuario_usuario_uid_fkey"
            columns: ["usuario_uid"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["uid"]
          },
        ]
      }
      precedencias_etapa: {
        Row: {
          etapa_id: number
          etapa_predecessora_id: number
          lag_dias: number | null
          tipo_relacao: string | null
        }
        Insert: {
          etapa_id: number
          etapa_predecessora_id: number
          lag_dias?: number | null
          tipo_relacao?: string | null
        }
        Update: {
          etapa_id?: number
          etapa_predecessora_id?: number
          lag_dias?: number | null
          tipo_relacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precedencias_etapa_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precedencias_etapa_etapa_predecessora_id_fkey"
            columns: ["etapa_predecessora_id"]
            isOneToOne: false
            referencedRelation: "etapas_orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          area_construida_m2: number | null
          calendario_id: string | null
          codigo_projeto: string | null
          created_at: string | null
          custo_direto_total: number | null
          data_inicio: string
          empresa_id: string | null
          id: string
          jornada_diaria_horas: number | null
          nome_projeto: string
          padrao_acabamento: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          area_construida_m2?: number | null
          calendario_id?: string | null
          codigo_projeto?: string | null
          created_at?: string | null
          custo_direto_total?: number | null
          data_inicio: string
          empresa_id?: string | null
          id?: string
          jornada_diaria_horas?: number | null
          nome_projeto: string
          padrao_acabamento?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          area_construida_m2?: number | null
          calendario_id?: string | null
          codigo_projeto?: string | null
          created_at?: string | null
          custo_direto_total?: number | null
          data_inicio?: string
          empresa_id?: string | null
          id?: string
          jornada_diaria_horas?: number | null
          nome_projeto?: string
          padrao_acabamento?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projetos_empresa"
            columns: ["empresa_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "empresas_fornecedores"
            referencedColumns: ["id", "contrato_id"]
          },
          {
            foreignKeyName: "projetos_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "calendarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      rdo_frentes_servico: {
        Row: {
          created_at: string | null
          funcionario_id: string
          id: string
          observacao: string | null
          papel: string | null
          rdo_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          funcionario_id: string
          id?: string
          observacao?: string | null
          papel?: string | null
          rdo_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          funcionario_id?: string
          id?: string
          observacao?: string | null
          papel?: string | null
          rdo_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_frentes_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_frentes_servico_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_frentes_servico_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "v_rdo_totais_por_projeto"
            referencedColumns: ["rdo_id"]
          },
        ]
      }
      rdo_items: {
        Row: {
          created_at: string | null
          id: string
          item_eap_id: string
          qtd_medida: number
          rdo_id: string
          tenant_id: string
          valor_total_dia: number
          valor_unitario_contrato: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_eap_id: string
          qtd_medida?: number
          rdo_id: string
          tenant_id: string
          valor_total_dia?: number
          valor_unitario_contrato?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_eap_id?: string
          qtd_medida?: number
          rdo_id?: string
          tenant_id?: string
          valor_total_dia?: number
          valor_unitario_contrato?: number
        }
        Relationships: [
          {
            foreignKeyName: "rdo_items_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "itens_eap"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_items_item_eap_id_fkey"
            columns: ["item_eap_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_eap_medicao"
            referencedColumns: ["item_eap_id"]
          },
          {
            foreignKeyName: "rdo_items_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_items_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "v_rdo_totais_por_projeto"
            referencedColumns: ["rdo_id"]
          },
        ]
      }
      rdo_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          rdo_item_id: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          rdo_item_id: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          rdo_item_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_photos_rdo_item_id_fkey"
            columns: ["rdo_item_id"]
            isOneToOne: false
            referencedRelation: "rdo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          clima_manha: string | null
          clima_tarde: string | null
          created_at: string | null
          data_rdo: string
          id: string
          numero_rdo: string
          ordem_servico_id: string | null
          projeto_id: string
          responsavel_id: string | null
          responsavel_rdo_id: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          clima_manha?: string | null
          clima_tarde?: string | null
          created_at?: string | null
          data_rdo?: string
          id?: string
          numero_rdo: string
          ordem_servico_id?: string | null
          projeto_id: string
          responsavel_id?: string | null
          responsavel_rdo_id?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          clima_manha?: string | null
          clima_tarde?: string | null
          created_at?: string | null
          data_rdo?: string
          id?: string
          numero_rdo?: string
          ordem_servico_id?: string | null
          projeto_id?: string
          responsavel_id?: string | null
          responsavel_rdo_id?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "rdos_responsavel_rdo_id_fkey"
            columns: ["responsavel_rdo_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_bases_insumos: {
        Row: {
          categoria: string
          codigo: string
          contrato_id: string
          created_at: string | null
          descricao: string
          id: string
          mes_ano_ref: string
          orgao: string
          preco: number | null
          unidade: string | null
        }
        Insert: {
          categoria: string
          codigo: string
          contrato_id: string
          created_at?: string | null
          descricao: string
          id?: string
          mes_ano_ref: string
          orgao: string
          preco?: number | null
          unidade?: string | null
        }
        Update: {
          categoria?: string
          codigo?: string
          contrato_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          mes_ano_ref?: string
          orgao?: string
          preco?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_bases_insumos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      ref_bases_servicos: {
        Row: {
          codigo_fonte: string | null
          contrato_id: string
          created_at: string | null
          descricao: string
          id: string
          item: string | null
          mes_ano_ref: string
          orgao: string
          preco_unitario: number | null
          unidade: string | null
        }
        Insert: {
          codigo_fonte?: string | null
          contrato_id: string
          created_at?: string | null
          descricao: string
          id?: string
          item?: string | null
          mes_ano_ref: string
          orgao: string
          preco_unitario?: number | null
          unidade?: string | null
        }
        Update: {
          codigo_fonte?: string | null
          contrato_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          item?: string | null
          mes_ano_ref?: string
          orgao?: string
          preco_unitario?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_bases_servicos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      ref_cargos_salarios: {
        Row: {
          codigo_cbo: string
          created_at: string | null
          cuai_valor: number | null
          fc_valor: number | null
          id: string
          nome_cargo: string
          salario_maior: number | null
          salario_medio: number | null
          salario_piso: number | null
          uf: string
          updated_at: string | null
        }
        Insert: {
          codigo_cbo: string
          created_at?: string | null
          cuai_valor?: number | null
          fc_valor?: number | null
          id?: string
          nome_cargo: string
          salario_maior?: number | null
          salario_medio?: number | null
          salario_piso?: number | null
          uf: string
          updated_at?: string | null
        }
        Update: {
          codigo_cbo?: string
          created_at?: string | null
          cuai_valor?: number | null
          fc_valor?: number | null
          id?: string
          nome_cargo?: string
          salario_maior?: number | null
          salario_medio?: number | null
          salario_piso?: number | null
          uf?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ref_cub_bases: {
        Row: {
          atualizado_em: string
          contrato_id: string
          criado_em: string
          dados_json: Json
          id: string
          mes_referencia: string
          sinduscon_nome: string
          uf: string
        }
        Insert: {
          atualizado_em?: string
          contrato_id: string
          criado_em?: string
          dados_json: Json
          id?: string
          mes_referencia: string
          sinduscon_nome: string
          uf: string
        }
        Update: {
          atualizado_em?: string
          contrato_id?: string
          criado_em?: string
          dados_json?: Json
          id?: string
          mes_referencia?: string
          sinduscon_nome?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "ref_cub_bases_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      ref_encargos_complementares: {
        Row: {
          categoria: string
          custo_horista_ref: number
          custo_mensalista_ref: number
          id: string
          item: string
          regra_calculo: string | null
          uf: string | null
        }
        Insert: {
          categoria: string
          custo_horista_ref: number
          custo_mensalista_ref: number
          id?: string
          item: string
          regra_calculo?: string | null
          uf?: string | null
        }
        Update: {
          categoria?: string
          custo_horista_ref?: number
          custo_mensalista_ref?: number
          id?: string
          item?: string
          regra_calculo?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      ref_encargos_especificos: {
        Row: {
          created_at: string
          custo_epi_hora_ref: number | null
          custo_epi_mes_ref: number | null
          custo_ferramentas_hora_ref: number | null
          custo_ferramentas_mes_ref: number | null
          especialidade_nome: string | null
          id: string
          uf: string | null
        }
        Insert: {
          created_at?: string
          custo_epi_hora_ref?: number | null
          custo_epi_mes_ref?: number | null
          custo_ferramentas_hora_ref?: number | null
          custo_ferramentas_mes_ref?: number | null
          especialidade_nome?: string | null
          id: string
          uf?: string | null
        }
        Update: {
          created_at?: string
          custo_epi_hora_ref?: number | null
          custo_epi_mes_ref?: number | null
          custo_ferramentas_hora_ref?: number | null
          custo_ferramentas_mes_ref?: number | null
          especialidade_nome?: string | null
          id?: string
          uf?: string | null
        }
        Relationships: []
      }
      ref_encargos_especificos_funcao: {
        Row: {
          epi_horista_ref: number
          epi_mensalista_ref: number
          ferramentas_horista_ref: number
          ferramentas_mensalista_ref: number
          id: string
          nome_funcao: string
        }
        Insert: {
          epi_horista_ref: number
          epi_mensalista_ref: number
          ferramentas_horista_ref: number
          ferramentas_mensalista_ref: number
          id?: string
          nome_funcao: string
        }
        Update: {
          epi_horista_ref?: number
          epi_mensalista_ref?: number
          ferramentas_horista_ref?: number
          ferramentas_mensalista_ref?: number
          id?: string
          nome_funcao?: string
        }
        Relationships: []
      }
      ref_matriz_encargos: {
        Row: {
          codigo_item: string | null
          created_at: string | null
          descricao: string | null
          grupo: string
          id: string
          pct_com_deson_horista: number | null
          pct_com_deson_mensalista: number | null
          pct_sem_deson_horista: number | null
          pct_sem_deson_mensalista: number | null
          uf: string
          updated_at: string | null
        }
        Insert: {
          codigo_item?: string | null
          created_at?: string | null
          descricao?: string | null
          grupo: string
          id?: string
          pct_com_deson_horista?: number | null
          pct_com_deson_mensalista?: number | null
          pct_sem_deson_horista?: number | null
          pct_sem_deson_mensalista?: number | null
          uf: string
          updated_at?: string | null
        }
        Update: {
          codigo_item?: string | null
          created_at?: string | null
          descricao?: string | null
          grupo?: string
          id?: string
          pct_com_deson_horista?: number | null
          pct_com_deson_mensalista?: number | null
          pct_sem_deson_horista?: number | null
          pct_sem_deson_mensalista?: number | null
          uf?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      simulacoes_projetos: {
        Row: {
          created_at: string | null
          dados_json: Json
          id: string
          nome: string
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dados_json: Json
          id?: string
          nome: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dados_json?: Json
          id?: string
          nome?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sistema_eventos_catalogo: {
        Row: {
          categoria: string
          cod_evento: string
          descricao: string
        }
        Insert: {
          categoria: string
          cod_evento: string
          descricao: string
        }
        Update: {
          categoria?: string
          cod_evento?: string
          descricao?: string
        }
        Relationships: []
      }
      system_error_log: {
        Row: {
          cod_evento: string
          contrato_id: string | null
          criado_em: string | null
          id: string
          mensagem: string
          rota: string | null
          stack_trace: string | null
          usuario_uid: string | null
        }
        Insert: {
          cod_evento: string
          contrato_id?: string | null
          criado_em?: string | null
          id?: string
          mensagem: string
          rota?: string | null
          stack_trace?: string | null
          usuario_uid?: string | null
        }
        Update: {
          cod_evento?: string
          contrato_id?: string | null
          criado_em?: string | null
          id?: string
          mensagem?: string
          rota?: string | null
          stack_trace?: string | null
          usuario_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_error_log_cod_evento_fkey"
            columns: ["cod_evento"]
            isOneToOne: false
            referencedRelation: "sistema_eventos_catalogo"
            referencedColumns: ["cod_evento"]
          },
        ]
      }
      tenant_bdi_configuracao: {
        Row: {
          bdi_calculado: number | null
          created_at: string | null
          id: string
          obra_id: string | null
          pct_administracao_central: number | null
          pct_cofins: number | null
          pct_cprb: number | null
          pct_despesas_financeiras: number | null
          pct_iss: number | null
          pct_lucro: number | null
          pct_pis: number | null
          pct_riscos: number | null
          pct_seguros_garantias: number | null
          tenant_id: string
          tipo_composicao: string
          updated_at: string | null
        }
        Insert: {
          bdi_calculado?: number | null
          created_at?: string | null
          id?: string
          obra_id?: string | null
          pct_administracao_central?: number | null
          pct_cofins?: number | null
          pct_cprb?: number | null
          pct_despesas_financeiras?: number | null
          pct_iss?: number | null
          pct_lucro?: number | null
          pct_pis?: number | null
          pct_riscos?: number | null
          pct_seguros_garantias?: number | null
          tenant_id: string
          tipo_composicao?: string
          updated_at?: string | null
        }
        Update: {
          bdi_calculado?: number | null
          created_at?: string | null
          id?: string
          obra_id?: string | null
          pct_administracao_central?: number | null
          pct_cofins?: number | null
          pct_cprb?: number | null
          pct_despesas_financeiras?: number | null
          pct_iss?: number | null
          pct_lucro?: number | null
          pct_pis?: number | null
          pct_riscos?: number | null
          pct_seguros_garantias?: number | null
          tenant_id?: string
          tipo_composicao?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_bdi_configuracao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      tenant_cargos_salarios: {
        Row: {
          codigo_cbo: string | null
          created_at: string | null
          cuai_adotado: number | null
          encargos_sociais_perc: number | null
          fc_adotado: number | null
          id: string
          nome_cargo: string
          obra_id: string | null
          ref_cargo_id: string | null
          salario_base_adotado: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          codigo_cbo?: string | null
          created_at?: string | null
          cuai_adotado?: number | null
          encargos_sociais_perc?: number | null
          fc_adotado?: number | null
          id?: string
          nome_cargo: string
          obra_id?: string | null
          ref_cargo_id?: string | null
          salario_base_adotado?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          codigo_cbo?: string | null
          created_at?: string | null
          cuai_adotado?: number | null
          encargos_sociais_perc?: number | null
          fc_adotado?: number | null
          id?: string
          nome_cargo?: string
          obra_id?: string | null
          ref_cargo_id?: string | null
          salario_base_adotado?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_cargos_salarios_ref_cargo_id_fkey"
            columns: ["ref_cargo_id"]
            isOneToOne: false
            referencedRelation: "ref_cargos_salarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_cargos_salarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      tenant_encargos_complementares: {
        Row: {
          categoria: string | null
          created_at: string | null
          custo_horista: number | null
          custo_mensalista: number | null
          id: string
          item: string | null
          obra_id: string
          ref_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          custo_horista?: number | null
          custo_mensalista?: number | null
          id?: string
          item?: string | null
          obra_id: string
          ref_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          custo_horista?: number | null
          custo_mensalista?: number | null
          id?: string
          item?: string | null
          obra_id?: string
          ref_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_encargos_complementares_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_encargos_complementares_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "tenant_encargos_complementares_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "ref_encargos_complementares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_encargos_complementares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      tenant_encargos_especificos: {
        Row: {
          codigo_cbo: string | null
          created_at: string | null
          epi_horista: number | null
          ferramentas_horista: number | null
          id: string
          nome_funcao: string | null
          obra_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          codigo_cbo?: string | null
          created_at?: string | null
          epi_horista?: number | null
          ferramentas_horista?: number | null
          id?: string
          nome_funcao?: string | null
          obra_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          codigo_cbo?: string | null
          created_at?: string | null
          epi_horista?: number | null
          ferramentas_horista?: number | null
          id?: string
          nome_funcao?: string | null
          obra_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_encargos_especificos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_encargos_especificos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "tenant_encargos_especificos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      tenant_parametros_mao_obra: {
        Row: {
          created_at: string | null
          horas_mes: number | null
          id: string
          obra_id: string | null
          pct_encargos_sociais: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          horas_mes?: number | null
          id?: string
          obra_id?: string | null
          pct_encargos_sociais?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          horas_mes?: number | null
          id?: string
          obra_id?: string | null
          pct_encargos_sociais?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_parametros_mao_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_parametros_mao_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "tenant_parametros_mao_obra_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      usuarios: {
        Row: {
          claims_pendentes: boolean | null
          contrato_id: string | null
          created_at: string | null
          email: string
          empresa_id: string | null
          foto_url: string | null
          nome: string | null
          perfil: string
          status: string | null
          uid: string
          updated_at: string | null
        }
        Insert: {
          claims_pendentes?: boolean | null
          contrato_id?: string | null
          created_at?: string | null
          email: string
          empresa_id?: string | null
          foto_url?: string | null
          nome?: string | null
          perfil?: string
          status?: string | null
          uid: string
          updated_at?: string | null
        }
        Update: {
          claims_pendentes?: boolean | null
          contrato_id?: string | null
          created_at?: string | null
          email?: string
          empresa_id?: string | null
          foto_url?: string | null
          nome?: string | null
          perfil?: string
          status?: string | null
          uid?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_usuarios_empresa"
            columns: ["empresa_id", "contrato_id"]
            isOneToOne: false
            referencedRelation: "empresas_fornecedores"
            referencedColumns: ["id", "contrato_id"]
          },
          {
            foreignKeyName: "usuarios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      validacoes_desenvolvedor: {
        Row: {
          agente: string
          criado_em: string
          descricao: string | null
          id: string
          link_referencia: string | null
          notas_validacao: string | null
          responsavel_uid: string | null
          status: string
          titulo: string
          validado_em: string | null
        }
        Insert: {
          agente?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          link_referencia?: string | null
          notas_validacao?: string | null
          responsavel_uid?: string | null
          status?: string
          titulo: string
          validado_em?: string | null
        }
        Update: {
          agente?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          link_referencia?: string | null
          notas_validacao?: string | null
          responsavel_uid?: string | null
          status?: string
          titulo?: string
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validacoes_desenvolvedor_responsavel_uid_fkey"
            columns: ["responsavel_uid"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["uid"]
          },
        ]
      }
    }
    Views: {
      v_contratos_obra_resumo: {
        Row: {
          contrato_obra_id: string | null
          contrato_status: string | null
          data_assinatura: string | null
          data_vigencia: string | null
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          medicao_valor_acumulado: number | null
          nome_projeto: string | null
          numero_contrato: string | null
          objeto: string | null
          percentual_executado: number | null
          projeto_id: string | null
          tenant_id: string | null
          total_medicoes: number | null
          valor_global: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_obra_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      v_custo_hora_real_mao_obra: {
        Row: {
          codigo_cbo: string | null
          custo_hora_real: number | null
          epi_horista: number | null
          ferramentas_horista: number | null
          nome_cargo: string | null
          obra_id: string | null
          pct_encargos_sociais: number | null
          salario_base_horista: number | null
          salario_base_mensal: number | null
          tenant_id: string | null
          total_encargos_gerais_horista: number | null
          valor_encargos_sociais_horista: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_parametros_mao_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_parametros_mao_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "tenant_parametros_mao_obra_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "empresa_contratante"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      v_permissoes_efetivas: {
        Row: {
          configuracoes_criar: boolean | null
          configuracoes_editar: boolean | null
          configuracoes_excluir: boolean | null
          configuracoes_ler: boolean | null
          contrato_id: string | null
          contratos_criar: boolean | null
          contratos_editar: boolean | null
          contratos_excluir: boolean | null
          contratos_ler: boolean | null
          cronogramas_criar: boolean | null
          cronogramas_editar: boolean | null
          cronogramas_excluir: boolean | null
          cronogramas_ler: boolean | null
          email: string | null
          empresa_id: string | null
          empresas_criar: boolean | null
          empresas_editar: boolean | null
          empresas_excluir: boolean | null
          empresas_ler: boolean | null
          entidades_criar: boolean | null
          entidades_editar: boolean | null
          entidades_excluir: boolean | null
          entidades_ler: boolean | null
          financeiro_criar: boolean | null
          financeiro_editar: boolean | null
          financeiro_excluir: boolean | null
          financeiro_ler: boolean | null
          medicoes_criar: boolean | null
          medicoes_editar: boolean | null
          medicoes_excluir: boolean | null
          medicoes_ler: boolean | null
          nome: string | null
          os_criar: boolean | null
          os_editar: boolean | null
          os_excluir: boolean | null
          os_ler: boolean | null
          perfil: string | null
          projetos_criar: boolean | null
          projetos_editar: boolean | null
          projetos_excluir: boolean | null
          projetos_ler: boolean | null
          rdo_criar: boolean | null
          rdo_editar: boolean | null
          rdo_excluir: boolean | null
          rdo_ler: boolean | null
          relatorios_ler: boolean | null
          usuario_uid: string | null
          usuarios_criar: boolean | null
          usuarios_editar: boolean | null
          usuarios_excluir: boolean | null
          usuarios_ler: boolean | null
        }
        Relationships: []
      }
      v_rdo_totais_por_projeto: {
        Row: {
          data_rdo: string | null
          projeto_id: string | null
          rdo_id: string | null
          status: string | null
          valor_total_rdo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      v_resumo_eap_medicao: {
        Row: {
          data_execucao: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao_servico: string | null
          duracao_dias: number | null
          e_analitico: boolean | null
          eap_codigo: string | null
          item_eap_id: string | null
          medicao_acumulada_valor: number | null
          medicao_corrente_valor: number | null
          nome_projeto: string | null
          percentual_executado_financeiro: number | null
          preco_unitario: number | null
          predecessores: Json | null
          projeto_data_inicio: string | null
          projeto_id: string | null
          quantidade_contratada: number | null
          unidade_medida: string | null
          valor_total_contratado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_eap_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_eap_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_obra_resumo"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
    }
    Functions: {
      check_funcionario_rdo_eligibility: {
        Args: { p_funcionario_id: string }
        Returns: Json
      }
      fn_calcular_dias_uteis_periodo: {
        Args: {
          p_calendario_id: string
          p_data_fim: string
          p_data_inicio: string
        }
        Returns: number
      }
      fn_calcular_horas_periodo: {
        Args: {
          p_calendario_id: string
          p_data_fim: string
          p_data_inicio: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

