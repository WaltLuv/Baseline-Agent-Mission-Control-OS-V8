"""Entry point for `agent-gateway` script.

Adds two operator-friendly subcommands beyond `serve`:

    agent-gateway              start FastMCP server (default)
    agent-gateway --doctor     check which CLI agents are reachable on PATH
    agent-gateway --port 8765  override port
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import shutil
import sys
from importlib.metadata import PackageNotFoundError, version

from .config import Config
from .gateway import build_app

log = logging.getLogger("agent_gateway")


def _doctor(cfg: Config) -> int:
    """Print a readiness report for the operator. Exit code is the number of
    missing required CLIs (so CI can gate on it)."""
    print("Baseline Agent Gateway — readiness check")
    try:
        print(f"  version  : {version('baseline-agent-gateway')}")
    except PackageNotFoundError:
        print("  version  : (dev install)")
    print(f"  enabled  : {', '.join(cfg.enabled_agents) or '(none)'}")
    print(f"  data_dir : {cfg.data_dir}")
    print(f"  MC_URL   : {cfg.mc_url or '(not set — telemetry disabled)'}")
    print()
    print("CLI agent availability:")
    cli_for = {"claude": "claude", "codex": "codex", "opencode": "opencode"}
    missing = 0
    for agent in cfg.enabled_agents:
        if agent == "hermes":
            ok = bool(cfg.hermes_url)
            sym = "✓" if ok else "✗"
            print(f"  {sym} hermes   HERMES_URL={cfg.hermes_url or '(unset)'}")
            if not ok:
                missing += 1
            continue
        binary = cli_for.get(agent)
        if not binary:
            print(f"  ? {agent:8s} unknown agent type")
            continue
        path = shutil.which(binary)
        sym = "✓" if path else "✗"
        print(f"  {sym} {agent:8s} {path or '(not on PATH)'}")
        if not path:
            missing += 1
    print()
    return missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent-gateway")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--doctor", action="store_true", help="Print readiness report and exit")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args(argv)

    logging.basicConfig(level=args.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
    cfg = Config()

    if args.doctor:
        return _doctor(cfg)

    cfg.ensure_dirs()
    app = build_app(cfg)

    # Start telemetry in a sibling thread so the gateway registers with MC
    # immediately on boot, not on first MCP tool call. The thread runs its
    # own asyncio loop and dies cleanly when the process exits.
    import threading

    def _telemetry_runner():
        import asyncio as _aio
        from .telemetry import MissionControlTelemetry
        loop = _aio.new_event_loop()
        _aio.set_event_loop(loop)
        try:
            tele = MissionControlTelemetry(cfg)
            loop.run_until_complete(tele.register())
            loop.run_until_complete(tele.heartbeat_loop())
        except Exception as e:
            log.warning("telemetry thread terminated: %s", e)
        finally:
            try:
                loop.close()
            except Exception:
                pass

    if cfg.mc_url and cfg.mc_api_key:
        t = threading.Thread(target=_telemetry_runner, name="mc-telemetry", daemon=True)
        t.start()
        log.info("Telemetry thread started — will register and heartbeat MC every %ss", cfg.mc_report_interval_secs)
    else:
        log.info("MC_URL/MC_API_KEY not set — telemetry disabled (gateway runs locally only)")

    # FastMCP's run helper handles its own asyncio loop
    log.info("Starting agent-gateway on http://%s:%s/mcp", args.host, args.port)
    log.info("Enabled agents: %s", cfg.enabled_agents)
    app.run(transport="http", host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
