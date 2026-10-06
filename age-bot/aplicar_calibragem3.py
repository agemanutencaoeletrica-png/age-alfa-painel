import shutil
import datetime
import os
import py_compile

# CALIBRAGEM 3 - PACOTE PARA INVERTER O RESULTADO (aprovado 23/09)
#
# Diagnostico de 23/09: 5 ganhos x 21 perdas. Ganho medio R$ 4,28 x perda
# media R$ 6,91 -> precisava acertar 62% so para empatar. Stop de 0,5% era
# menor que o "ruido" normal das moedas; a mesma moeda perdia varias vezes
# seguidas (INJ 7x, BCH 5x); ouro dobrado (XAUT + PAXG).
#
# P1 COOLDOWN   : depois de uma PERDA a moeda fica 90 min fora; no maximo
#                 2 perdas por moeda por dia. Grava em dados/cooldown_ativos.json
# P2 STOP ATR   : stop = 1,2 x ATR de 15 min (minimo 0,8%, maximo 2,5%),
#                 take = 2 x stop. A quantidade e recalculada para o risco
#                 em R$ continuar o MESMO (stop maior -> posicao menor).
# P3 TRAILING   : so ativa com 1,5R a favor e devolve 0,5R (antes 0,7%/0,2%)
# P4 RISCO FIXO : 0,5% da banca em toda operacao durante a calibragem
#                 (antes subia para 0,75% depois de 1 perda)
# P5 OURO       : XAUT e PAXG sao o mesmo ativo -> nunca os dois abertos,
#                 e a perda de um bloqueia o outro no cooldown
# P6 TEMPO      : operacao com 120 min que nao chegou a 0,5R a favor (e sem
#                 trailing) e fechada a mercado (motivo "TEMPO")
#
# Cada item tem chave liga/desliga no auto_trade.py (procure CALIBRAGEM-3).

CAMINHO = os.path.join("modules", "modules", "auto_trade.py")
MARCADOR = "# CALIBRAGEM-3-PACOTE"

if not os.path.exists(CAMINHO):
    print(f"ERRO: nao encontrei {CAMINHO}. Rode na pasta do bot. Nada alterado.")
    raise SystemExit(1)

with open(CAMINHO, "r", encoding="utf-8") as f:
    texto = f.read()

if MARCADOR in texto:
    print("Calibragem 3 ja aplicada anteriormente. Nada alterado.")
    print("Chaves: procure CALIBRAGEM-3-CHAVES no auto_trade.py.")
    raise SystemExit(0)

for obrigatorio in ("# FASE2-STOP-TAKE-ATR", "# CORRECAO-11-ESPERA-PROTECAO-BINGX",
                    "# REDE-NEURAL-FASE1-RESULTADO", "# CORRECAO-8-STATUS-PELO-RESULTADO-REAL"):
    if obrigatorio not in texto:
        print(f"ERRO: trecho esperado nao encontrado ({obrigatorio}). Nada alterado.")
        raise SystemExit(1)


def trocar(conteudo, antigo, novo, nome):
    n = conteudo.count(antigo)
    if n != 1:
        print(f"ERRO [{nome}]: esperava 1 ocorrencia, encontrei {n}. Nada alterado.")
        raise SystemExit(1)
    return conteudo.replace(antigo, novo)


# ---------------------------------------------------------------- chaves
CHAVES = r'''
# CALIBRAGEM-3-PACOTE
# CALIBRAGEM-3-CHAVES  (True = ligado / False = desligado)
CALIB3_COOLDOWN_ATIVO = True        # P1
COOLDOWN_PERDA_MIN = 90             # P1: minutos fora depois de uma perda
MAX_PERDAS_ATIVO_DIA = 2            # P1: perdas por moeda por dia (0 = sem limite)
CALIB3_STOP_ATR_15M = True          # P2
CALIB3_TRAILING_PACIENTE = True     # P3
CALIB3_RETORNO_TRAILING_MAX = 0.01  # P3: devolucao maxima do trailing (1%)
CALIB3_RISCO_FIXO = True            # P4
RISCO_FIXO_CALIBRAGEM = 0.005       # P4: 0,5% da banca
CALIB3_GRUPOS_CORRELACIONADOS = True  # P5
GRUPOS_CORRELACIONADOS = [
    {"XAUTUSDT", "PAXGUSDT"},       # ouro tokenizado (mesmo ativo)
]
CALIB3_SAIDA_POR_TEMPO = True       # P6
TEMPO_MAX_OPERACAO_MIN = 120        # P6: minutos
SAIDA_TEMPO_MANTER_SE_R = 0.5       # P6: com 0,5R ou mais a favor, NAO fecha
MOTIVO_SAIDA_TEMPO = "TEMPO"

if CALIB3_STOP_ATR_15M:
    MODO_STOP_TAKE_ATR = "ATIVO"
    FASE2_FONTE_D = "ATR_15M"
    FASE2_MULT_ATR = 1.2
    ATR_DISTANCIA_STOP_MIN = 0.008
    ATR_DISTANCIA_STOP_MAX = 0.025
    ATR_MULT_TAKE = 2.0

if CALIB3_TRAILING_PACIENTE:
    ATR_MULT_ATIVACAO_TRAILING = 1.5
    ATR_MULT_RETORNO_TRAILING = 0.5
    # sem ATR (stop fixo de 0,5%): 1,5R = 0,75% e 0,5R = 0,25%
    ATIVACAO_TRAILING = 0.0075
    DISTANCIA_TRAILING = 0.0025

_CALIB3_LOCK = threading.RLock()
_CALIB3_ESTADO = {}


def _calib3_norm(ativo):
    return (
        str(ativo or "").upper().strip()
        .replace("-", "").replace("_", "").replace("/", "").replace(" ", "")
    )


def _calib3_grupo(ativo):
    chave = _calib3_norm(ativo)
    if CALIB3_GRUPOS_CORRELACIONADOS:
        for grupo in GRUPOS_CORRELACIONADOS:
            if chave in grupo:
                return set(grupo)
    return {chave}


def _calib3_arquivo():
    try:
        from modules.modules.configuracoes_sistema import PASTA_RAIZ
    except Exception:
        PASTA_RAIZ = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
    return os.path.join(PASTA_RAIZ, "dados", "cooldown_ativos.json")


def _calib3_hoje():
    return datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m-%d")


def _calib3_semear_do_historico():
    """Primeiro uso: conta as perdas de hoje que ja estao no historico."""
    perdas, ultima = {}, {}
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%d/%m/%Y")
    try:
        with OPERACOES_FECHADAS_LOCK:
            fechadas = list(OPERACOES_FECHADAS)
    except Exception:
        fechadas = []
    for registro in fechadas:
        try:
            if str(registro.get("data", "")) != hoje:
                continue
            if float(registro.get("lucro", 0) or 0) >= 0:
                continue
            chave = _calib3_norm(registro.get("ativo"))
            perdas[chave] = perdas.get(chave, 0) + 1
            momento = datetime.strptime(
                str(registro.get("data_hora", "")), "%d/%m/%Y %H:%M:%S"
            ).replace(tzinfo=ZoneInfo("America/Sao_Paulo")).timestamp()
            ultima[chave] = max(ultima.get(chave, 0.0), momento)
        except Exception:
            continue
    return perdas, ultima


def _calib3_estado():
    with _CALIB3_LOCK:
        if not _CALIB3_ESTADO:
            dados = None
            try:
                with open(_calib3_arquivo(), "r", encoding="utf-8") as f:
                    dados = json.load(f)
            except FileNotFoundError:
                perdas, ultima = _calib3_semear_do_historico()
                dados = {"data": _calib3_hoje(), "perdas_dia": perdas, "ultima_perda": ultima}
                if perdas:
                    log(f"CALIBRAGEM 3 | perdas de hoje lidas do historico: {perdas}")
            except Exception as erro:
                log(f"CALIBRAGEM 3 | AVISO ao ler cooldown: {type(erro).__name__}: {erro}")
            if not isinstance(dados, dict):
                dados = {}
            _CALIB3_ESTADO["data"] = str(dados.get("data", _calib3_hoje()))
            _CALIB3_ESTADO["perdas_dia"] = dict(dados.get("perdas_dia") or {})
            _CALIB3_ESTADO["ultima_perda"] = dict(dados.get("ultima_perda") or {})

        if _CALIB3_ESTADO["data"] != _calib3_hoje():
            _CALIB3_ESTADO["data"] = _calib3_hoje()
            _CALIB3_ESTADO["perdas_dia"] = {}
        return _CALIB3_ESTADO


def _calib3_salvar():
    try:
        caminho = _calib3_arquivo()
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        temporario = caminho + ".tmp"
        with _CALIB3_LOCK:
            with open(temporario, "w", encoding="utf-8") as f:
                json.dump(_CALIB3_ESTADO, f, ensure_ascii=True, indent=2)
        os.replace(temporario, caminho)
    except Exception as erro:
        log(f"CALIBRAGEM 3 | AVISO ao gravar cooldown: {type(erro).__name__}: {erro}")


def _calib3_motivo_bloqueio(ativo):
    """Texto com o motivo do bloqueio, ou "" se a moeda pode operar."""
    chave = _calib3_norm(ativo)
    grupo = _calib3_grupo(chave)

    if CALIB3_COOLDOWN_ATIVO:
        estado = _calib3_estado()
        perdas = int(estado["perdas_dia"].get(chave, 0) or 0)
        if MAX_PERDAS_ATIVO_DIA > 0 and perdas >= MAX_PERDAS_ATIVO_DIA:
            return f"{perdas} perdas hoje (limite {MAX_PERDAS_ATIVO_DIA}) - volta amanha"
        ultima = max(float(estado["ultima_perda"].get(m, 0) or 0) for m in grupo)
        falta = COOLDOWN_PERDA_MIN * 60 - (time.time() - ultima)
        if falta > 0:
            return f"cooldown depois de perda (faltam {falta / 60:.0f} min)"

    if CALIB3_GRUPOS_CORRELACIONADOS and len(grupo) > 1:
        with OPERACOES_DEMO_LOCK:
            abertos = {_calib3_norm(a) for a in OPERACOES_DEMO}
        outros = (grupo & abertos) - {chave}
        if outros:
            return f"ativo correlacionado ja aberto ({', '.join(sorted(outros))})"

    return ""


def _calib3_registrar_fechamento(ativo, lucro_liquido):
    if float(lucro_liquido or 0) >= 0:
        return
    chave = _calib3_norm(ativo)
    with _CALIB3_LOCK:
        estado = _calib3_estado()
        estado["perdas_dia"][chave] = int(estado["perdas_dia"].get(chave, 0) or 0) + 1
        estado["ultima_perda"][chave] = time.time()
        perdas = estado["perdas_dia"][chave]
    _calib3_salvar()
    if CALIB3_COOLDOWN_ATIVO:
        log(
            f"CALIBRAGEM 3 | {ativo} | perda registrada ({perdas} hoje) | "
            f"fora por {COOLDOWN_PERDA_MIN} min"
            + (" | limite do dia atingido" if 0 < MAX_PERDAS_ATIVO_DIA <= perdas else "")
        )


def _calib3_risco_operacao():
    if CALIB3_RISCO_FIXO:
        return float(RISCO_FIXO_CALIBRAGEM)
    return float(RISCO_ATUAL)


def _calib3_saida_por_tempo(ativo, operacao, preco):
    if not CALIB3_SAIDA_POR_TEMPO:
        return None
    if operacao.get("fechando", False) or operacao.get("trailing_ativo", False):
        return None
    try:
        inicio = float(operacao.get("inicio") or 0)
        entrada = float(operacao.get("entrada") or 0)
        stop_inicial = float(operacao.get("stop_original") or operacao.get("stop") or 0)
        preco = float(preco)
    except (TypeError, ValueError):
        return None
    if inicio <= 0 or entrada <= 0 or stop_inicial <= 0 or preco <= 0:
        return None

    minutos = (time.time() - inicio) / 60.0
    if minutos < TEMPO_MAX_OPERACAO_MIN:
        return None

    risco = abs(entrada - stop_inicial)
    if risco <= 0:
        return None

    tipo = str(operacao.get("tipo", "")).upper().strip()
    if tipo == "LONG":
        andou = preco - entrada
    elif tipo == "SHORT":
        andou = entrada - preco
    else:
        return None

    resultado_r = andou / risco
    if resultado_r >= SAIDA_TEMPO_MANTER_SE_R:
        return None

    status = "WIN" if andou > 0 else ("LOSS" if andou < 0 else "BREAKEVEN")
    log(
        f"CALIBRAGEM 3 | SAIDA POR TEMPO | {ativo} | {tipo} | "
        f"{minutos:.0f} min sem chegar a {SAIDA_TEMPO_MANTER_SE_R}R "
        f"(agora {resultado_r:+.2f}R) | fechando a mercado"
    )
    return {
        "ativo": ativo,
        "status": status,
        "motivo": MOTIVO_SAIDA_TEMPO,
        "saida": preco,
    }


try:
    log(
        "CALIBRAGEM 3 | "
        f"P1 cooldown={'ON' if CALIB3_COOLDOWN_ATIVO else 'OFF'} ({COOLDOWN_PERDA_MIN} min, max {MAX_PERDAS_ATIVO_DIA}/dia) | "
        f"P2 stop ATR15m={'ON' if CALIB3_STOP_ATR_15M else 'OFF'} | "
        f"P3 trailing 1,5R/0,5R={'ON' if CALIB3_TRAILING_PACIENTE else 'OFF'} | "
        f"P4 risco fixo={'ON' if CALIB3_RISCO_FIXO else 'OFF'} ({RISCO_FIXO_CALIBRAGEM * 100:.2f}%) | "
        f"P5 ouro={'ON' if CALIB3_GRUPOS_CORRELACIONADOS else 'OFF'} | "
        f"P6 tempo={'ON' if CALIB3_SAIDA_POR_TEMPO else 'OFF'} ({TEMPO_MAX_OPERACAO_MIN} min)"
    )
except Exception:
    pass
'''

novo = trocar(texto, "FASE2_MULT_ATR = 1.0\n", "FASE2_MULT_ATR = 1.0\n" + CHAVES, "chaves")

# ---------------------------------------------------------------- P2 fonte ATR 15m
novo = trocar(
    novo,
    '    if FASE2_FONTE_D == "ATR_1H" and atr_pct_1h > 0:\n'
    "        d_bruto = atr_pct_1h * FASE2_MULT_ATR\n"
    '        fonte_d = "ATR_1H"\n',
    "    # CALIBRAGEM-3-P2-ATR-15M\n"
    '    if FASE2_FONTE_D == "ATR_15M" and atr_pct_15m > 0:\n'
    "        d_bruto = atr_pct_15m * FASE2_MULT_ATR\n"
    '        fonte_d = "ATR_15M"\n'
    '    elif FASE2_FONTE_D in ("ATR_1H", "ATR_15M") and atr_pct_1h > 0:\n'
    "        d_bruto = atr_pct_1h * (\n"
    '            FASE2_MULT_ATR if FASE2_FONTE_D == "ATR_1H" else 1.0\n'
    "        )\n"
    '        fonte_d = "ATR_1H"\n',
    "P2 fonte",
)

# ---------------------------------------------------------------- P3 teto da devolucao
novo = trocar(
    novo,
    '"distancia_trailing_pct": round(max(d * ATR_MULT_RETORNO_TRAILING, 0.001), 4),',
    '"distancia_trailing_pct": round(min(max(d * ATR_MULT_RETORNO_TRAILING, 0.001), CALIB3_RETORNO_TRAILING_MAX), 4),',
    "P3 teto",
)

# ---------------------------------------------------------------- P2 sem ATR -> stop minimo
RESERVA = r'''

# CALIBRAGEM-3-P2-RESERVA
# Com o P2 ligado, se o ia.py nao tiver ATR valido para a moeda, usa o stop
# minimo (0,8%) em vez de voltar ao 0,5% fixo antigo.
_niveis_atr_operacao_fase2 = _niveis_atr_operacao


def _niveis_atr_operacao(ativo, tipo):
    niveis = _niveis_atr_operacao_fase2(ativo, tipo)
    if niveis is None and CALIB3_STOP_ATR_15M and MODO_STOP_TAKE_ATR == "ATIVO":
        d = ATR_DISTANCIA_STOP_MIN
        niveis = {
            "distancia_stop_pct": d,
            "distancia_take_pct": d * ATR_MULT_TAKE,
            "ativacao_trailing_pct": d * ATR_MULT_ATIVACAO_TRAILING,
            "distancia_trailing_pct": round(
                min(max(d * ATR_MULT_RETORNO_TRAILING, 0.001), CALIB3_RETORNO_TRAILING_MAX), 4
            ),
            "distancia_stop_bruta_pct": d,
        }
        log(
            f"CALIBRAGEM 3 | {ativo} | {tipo} | sem ATR valido - usando stop "
            f"minimo {d * 100:.2f}% / take {d * ATR_MULT_TAKE * 100:.2f}%"
        )
    return niveis'''

novo = trocar(
    novo,
    "\n\ndef _aplicar_niveis_atr(",
    RESERVA + "\n\n\ndef _aplicar_niveis_atr(",
    "P2 reserva",
)

# ---------------------------------------------------------------- P1/P5 selecao
ANTIGO_SEL = (
    "                    if (\n"
    '                        candidato.get("decisao_filtro", "REPROVADA") == "APROVADA"\n'
    '                        and sinal_candidato in ("LONG", "SHORT")\n'
    "                    ):\n"
)
NOVO_SEL = (
    "                    # CALIBRAGEM-3-P1-P5-BLOQUEIO\n"
    "                    try:\n"
    "                        _motivo_calib3 = _calib3_motivo_bloqueio(ativo_candidato)\n"
    "                    except Exception as _erro_calib3:\n"
    "                        _motivo_calib3 = \"\"\n"
    "                        log(\n"
    '                            f"CALIBRAGEM 3 | AVISO bloqueio {ativo_candidato} | "\n'
    '                            f"{type(_erro_calib3).__name__}: {_erro_calib3}"\n'
    "                        )\n"
    "                    if _motivo_calib3:\n"
    '                        if candidato.get("decisao_filtro", "REPROVADA") == "APROVADA":\n'
    "                            log(\n"
    '                                f"CALIBRAGEM 3 | {ativo_candidato} ignorado: "\n'
    '                                f"{_motivo_calib3}"\n'
    "                            )\n"
    "                        continue\n"
    "\n"
    + ANTIGO_SEL
)
novo = trocar(novo, ANTIGO_SEL, NOVO_SEL, "P1/P5 selecao")

# ---------------------------------------------------------------- P4 risco
novo = trocar(
    novo,
    "risco_percentual=RISCO_ATUAL * 100,",
    "risco_percentual=_calib3_risco_operacao() * 100,  # CALIBRAGEM-3-P4",
    "P4 risco",
)

# ---------------------------------------------------------------- P1 registro da perda
ANTIGO_RN = (
    '                    f"AVISO REDE NEURAL (nao afeta a operacao) | {ativo} | "\n'
    '                    f"{type(erro_rede_neural).__name__}: {erro_rede_neural}"\n'
    "                )\n"
)
NOVO_RN = ANTIGO_RN + (
    "\n"
    "            # CALIBRAGEM-3-P1-REGISTRO\n"
    "            try:\n"
    "                _calib3_registrar_fechamento(ativo, lucro_liquido)\n"
    "            except Exception as erro_calib3:\n"
    "                log(\n"
    '                    f"CALIBRAGEM 3 | AVISO cooldown {ativo} | "\n'
    '                    f"{type(erro_calib3).__name__}: {erro_calib3}"\n'
    "                )\n"
)
novo = trocar(novo, ANTIGO_RN, NOVO_RN, "P1 registro")

# ---------------------------------------------------------------- P6 deteccao
ANCORA_P6 = "    # O retorno precisa ficar fora do for para verificar todas as opera"
novo = trocar(
    novo,
    ANCORA_P6,
    "    # CALIBRAGEM-3-P6-SAIDA-POR-TEMPO\n"
    "    try:\n"
    '        _ja_fechando = {item["ativo"] for item in operacoes_para_fechar}\n'
    "        for _ativo_t, _operacao_t in operacoes_snapshot.items():\n"
    "            if _ativo_t in _ja_fechando or _ativo_t not in precos_operacoes:\n"
    "                continue\n"
    "            _item_t = _calib3_saida_por_tempo(\n"
    "                _ativo_t, _operacao_t, precos_operacoes[_ativo_t]\n"
    "            )\n"
    "            if _item_t:\n"
    "                operacoes_para_fechar.append(_item_t)\n"
    "    except Exception as _erro_tempo:\n"
    "        log(\n"
    '            f"CALIBRAGEM 3 | AVISO saida por tempo | "\n'
    '            f"{type(_erro_tempo).__name__}: {_erro_tempo}"\n'
    "        )\n"
    "\n"
    + ANCORA_P6,
    "P6 deteccao",
)

# ---------------------------------------------------------------- P6 sem espera da C11
novo = trocar(
    novo,
    "                                if _c11_esperando < ESPERA_PROTECAO_BINGX_SEGUNDOS:\n",
    "                                # CALIBRAGEM-3-P6: saida por tempo nao espera a BingX\n"
    "                                if (\n"
    "                                    _c11_esperando < ESPERA_PROTECAO_BINGX_SEGUNDOS\n"
    '                                    and str(fechamento.get("motivo", "")) != MOTIVO_SAIDA_TEMPO\n'
    "                                ):\n",
    "P6 C11",
)

# ---------------------------------------------------------------- gravacao
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup = f"{CAMINHO}.bak_calibragem3_{timestamp}"
shutil.copy(CAMINHO, backup)
print(f"Backup salvo em: {backup}")

try:
    with open(CAMINHO, "w", encoding="utf-8") as f:
        f.write(novo)
    py_compile.compile(CAMINHO, doraise=True)
except Exception as erro:
    shutil.copy(backup, CAMINHO)
    print("ERRO - auto_trade.py restaurado do backup:")
    print(erro)
    raise SystemExit(1)

print("Calibragem 3 aplicada no auto_trade.py:")
print("  P1 cooldown     : 90 min fora depois de perda, max 2 perdas por moeda/dia")
print("  P2 stop ATR 15m : stop 1,2 x ATR15m (0,8% a 2,5%), take 2 x stop, risco em R$ igual")
print("  P3 trailing     : ativa em 1,5R, devolve 0,5R (max 1%)")
print("  P4 risco fixo   : 0,5% da banca em toda operacao")
print("  P5 ouro         : XAUT e PAXG nunca abertos juntos")
print("  P6 tempo        : 120 min sem chegar a 0,5R -> fecha a mercado (motivo TEMPO)")
print("Chaves liga/desliga: procure CALIBRAGEM-3-CHAVES no auto_trade.py.")
print("No log procure: CALIBRAGEM 3")
print("SINTAXE OK")
