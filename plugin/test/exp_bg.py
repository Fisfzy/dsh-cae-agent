# ruff: noqa
# Complete background experiment: start CAE via script=, wait for bridge,
# probe with a PURE ping (no mdb) to isolate threading vs mdb-access blocking.
# Writes every step to EXPRESULT file so it survives session interruptions.
import os, subprocess, socket, json, time, sys, datetime

WS = r"C:\Users\Fisfzy\AppData\Local\Temp\abaqus-cae"
PLUGIN = r"D:\AIWORK\dsh-cae-agent\plugin\bridge\cae_bridge_plugin.py"
RESULT = os.path.join(WS, "EXPRESULT.txt")
BRIDGE_PORT = 48152

def log(s):
    with open(RESULT, "a") as f:
        f.write("[%s] %s\n" % (datetime.datetime.now().isoformat(), s))

open(RESULT, "w").close()
log("== EXPERIMENT START pid=%s ==" % os.getpid())

# Write the CAE script that loads the kernel bridge + keepalive.
st = os.path.join(WS, "exp_script.py")
with open(st, "w") as f:
    f.write(
        "import os, json, time, __main__\n"
        "plugin = %r\n" % PLUGIN
        + "with open(plugin,'r',encoding='utf-8') as h:\n"
        "    exec(compile(h.read(), plugin, 'exec'), __main__.__dict__)\n"
        "try:\n"
        "    msg = __main__.mcp_start()\n"
        "    print('BRIDGE_OK ' + str(msg), flush=True)\n"
        "except Exception as e:\n"
        "    import traceback; print('BRIDGE_ERR %r' % e, flush=True); print(traceback.format_exc(), flush=True)\n"
        "while True:\n"
        "    time.sleep(3600)\n"
    )
log("caescript written: %s" % st)

# Launch Abaqus CAE script= (no GUI).
log("launching abaqus cae script= ...")
p = subprocess.Popen(
    ["D:/SIMULIA/Commands/abaqus.bat", "cae", "script=" + st],
    cwd=WS,
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
)
log("launch pid=%s" % p.pid)

# Wait up to 90s for the bridge port.
up = False
for i in range(30):
    time.sleep(3)
    s = socket.socket()
    s.settimeout(1)
    try:
        s.connect(("127.0.0.1", BRIDGE_PORT))
        up = True
        s.close()
        log("bridge port UP after %ss" % ((i + 1) * 3))
        break
    except Exception as e:
        s.close()
        log("bridge not up yet (%ss): %s" % ((i + 1) * 3, e))
if not up:
    log("bridge never came up within 90s")
    log("== done (no bridge) ==")
    sys.exit(0)

def ping(method, params, label):
    s = socket.socket()
    s.settimeout(8)
    try:
        s.connect(("127.0.0.1", BRIDGE_PORT))
        s.sendall((json.dumps({"id": "x" + label, "method": method, "params": params}) + "\n").encode())
        buf = b""
        while b"\n" not in buf:
            chunk = s.recv(4096)
            if not chunk:
                break
            buf += chunk
        line = buf.split(b"\n")[0].decode("utf-8", "replace")
        log("PING[%s] RESP: %s" % (label, line[:200]))
    except Exception as e:
        log("PING[%s] ERROR: %r" % (label, e))
    finally:
        s.close()

# PURE ping: does not touch mdb (isolation: threading vs mdb-access).
ping("ping", {"timeout": 15}, "empty")
time.sleep(2)
# Model-dependent ping (via _kernel_ping which reads mdb.models).
ping("execute", {"code": "result = 42", "timeout": 15}, "math")
time.sleep(2)
ping("ping", {"timeout": 30}, "mdb")

log("== EXPERIMENT DONE ==")
