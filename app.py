from flask import Flask, jsonify, request, send_from_directory
from threading import Lock, current_thread
from time import time, strftime, localtime
import uuid, traceback, sys, argparse

app = Flask(__name__, static_folder="static", static_url_path="/static")
from flask_cors import CORS
CORS(app)

lock = Lock()

board = [None] * 9
placements = {"X": [], "O": []}
clients = {}   
current_turn = "X"
winner = None
move_counter = 0
challenges = []  

WIN_LINES = [
    (0,1,2),(3,4,5),(6,7,8),
    (0,3,6),(1,4,7),(2,5,8),
    (0,4,8),(2,4,6)
]

def now():
    return strftime("%Y-%m-%d %H:%M:%S", localtime())

def log(*args, **kwargs):
    print(now(), *args, **kwargs, flush=True)

def log_exception(context=""):
    log(f"EXCEPTION in {context}:")
    traceback.print_exc(file=sys.stdout)
    sys.stdout.flush()

def check_winner():
    global winner
    for a,b,c in WIN_LINES:
        if board[a] and board[a] == board[b] == board[c]:
            winner = board[a]
            return winner
    return None

def assign_role_for_join(name, cid):
    taken = {c.get("symbol") for c in clients.values() if c.get("role") == "player" and c.get("symbol")}
    if "X" not in taken:
        return {"role": "player", "symbol": "X"}
    elif "O" not in taken:
        return {"role": "player", "symbol": "O"}
    else:
        return {"role": "spectator", "symbol": None}

def place_symbol(symbol, pos, cid):
    global move_counter, winner
    with lock:
        if winner is not None:
            return False, "Game already finished."
        if pos < 0 or pos > 8:
            return False, "Bad position."
        if board[pos] is not None:
            return False, "Cell already occupied."
        lst = placements[symbol]
        if len(lst) == 3:
            earliest_pos = lst[0]["pos"]
            if pos == earliest_pos:
                return False, "Cannot place 4th copy in the same cell as the earliest copy."
            rem = lst.pop(0)
            board[rem["pos"]] = None
        t = time()
        lst.append({"pos": pos, "t": t, "cid": cid})
        board[pos] = symbol
        move_counter += 1
        w = check_winner()
        return True, ("Placed" if w is None else f"{symbol} wins!")

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/join", methods=["POST"])
def join():
    try:
        data = request.get_json() or {}
        cid = data.get("cid")
        name = (data.get("name") or "").strip() or "Player"
        if not cid:
            return jsonify({"ok": False, "msg": "cid required"}), 400
        with lock:
            if cid in clients:
                clients[cid]["name"] = name
                clients[cid]["last_seen"] = time()
                return jsonify({"ok": True, "role": clients[cid]["role"], "symbol": clients[cid].get("symbol"), "name": name, "msg":"re-joined"})
            assignment = assign_role_for_join(name, cid)
            clients[cid] = {
                "name": name,
                "role": assignment["role"],
                "symbol": assignment["symbol"],
                "last_seen": time()
            }
            return jsonify({"ok": True, "role": clients[cid]["role"], "symbol": clients[cid].get("symbol"), "name": name, "msg":"joined"})
    except Exception as e:
        log_exception("join")
        return jsonify({"ok": False, "msg": str(e)}), 500

@app.route("/clients", methods=["GET"])
def get_clients():
    try:
        with lock:
            lst = [{"cid": cid, "name": c["name"], "role": c["role"], "symbol": c.get("symbol")} for cid, c in clients.items()]
            return jsonify({"ok": True, "clients": lst})
    except Exception:
        log_exception("get_clients")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/state", methods=["GET"])
def state():
    try:
        with lock:
            return jsonify({
                "board": board,
                "placements": placements,
                "clients": {cid: {"name": c["name"], "role": c["role"], "symbol": c.get("symbol")} for cid, c in clients.items()},
                "current_turn": current_turn,
                "winner": winner,
                "move_counter": move_counter
            })
    except Exception:
        log_exception("state")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/move", methods=["POST"])
def move():
    global current_turn
    try:
        data = request.get_json() or {}
        cid = data.get("cid")
        pos = data.get("pos")
        if cid is None or pos is None:
            return jsonify({"ok": False, "msg": "cid and pos required"}), 400
        with lock:
            if cid not in clients:
                return jsonify({"ok": False, "msg": "You are not a client. Call /join first."}), 403
            client = clients[cid]
            if client.get("role") != "player":
                return jsonify({"ok": False, "msg": "Spectators cannot play."}), 403
            symbol = client.get("symbol")
            if winner is not None:
                return jsonify({"ok": False, "msg": f"Game over: {winner}"}), 400
            if symbol != current_turn:
                return jsonify({"ok": False, "msg": "Not your turn."}), 403
        ok, msg = place_symbol(symbol, int(pos), cid)
        if not ok:
            return jsonify({"ok": False, "msg": msg}), 400
        if winner is None:
            with lock:
                current_turn = "O" if current_turn == "X" else "X"
        return jsonify({"ok": True, "msg": msg, "winner": winner, "current_turn": current_turn})
    except Exception:
        log_exception("move")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/reset_board", methods=["POST"])
def reset_board():
    global board, placements, current_turn, winner, move_counter
    try:
        with lock:
            board = [None] * 9
            placements = {"X": [], "O": []}
            current_turn = "X"
            winner = None
            move_counter = 0
        return jsonify({"ok": True, "msg": "Board reset (clients preserved)."})
    except Exception:
        log_exception("reset_board")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/reset", methods=["POST"])
def reset_all():
    global board, placements, clients, current_turn, winner, move_counter, challenges
    try:
        with lock:
            board = [None] * 9
            placements = {"X": [], "O": []}
            clients = {}
            current_turn = "X"
            winner = None
            move_counter = 0
            challenges = []
        return jsonify({"ok": True, "msg": "Reset done."})
    except Exception:
        log_exception("reset_all")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/clear_sessions", methods=["POST"])
def clear_sessions():
    global clients, challenges
    try:
        with lock:
            clients = {}
            challenges = []
        return jsonify({"ok": True, "msg": "Cleared sessions (clients & challenges)."})
    except Exception:
        log_exception("clear_sessions")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/challenge", methods=["POST"])
def challenge():
    try:
        data = request.get_json() or {}
        from_cid = data.get("from_cid")
        to_cid = data.get("to_cid")
        if not from_cid or not to_cid:
            return jsonify({"ok": False, "msg": "from_cid and to_cid required"}), 400
        with lock:
            if from_cid not in clients or to_cid not in clients:
                return jsonify({"ok": False, "msg": "Unknown client id(s)"}), 400
            if from_cid == to_cid:
                return jsonify({"ok": False, "msg": "Cannot challenge yourself"}), 400
            chal = {"id": str(uuid.uuid4()), "from_cid": from_cid, "to_cid": to_cid, "status": "pending", "ts": time()}
            challenges.append(chal)
            return jsonify({"ok": True, "challenge": chal})
    except Exception:
        log_exception("challenge")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/challenges", methods=["GET"])
def get_challenges():
    try:
        cid_q = request.args.get("cid")
        frm = request.args.get("from")
        with lock:
            res = []
            for c in challenges:
                if cid_q and c["to_cid"] == cid_q:
                    res.append(c)
                elif frm and c["from_cid"] == frm:
                    res.append(c)
                elif not cid_q and not frm:
                    res.append(c)
            return jsonify({"ok": True, "challenges": res})
    except Exception:
        log_exception("get_challenges")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/challenge/respond", methods=["POST"])
def respond_challenge():
    try:
        data = request.get_json() or {}
        cid = data.get("cid")
        challenge_id = data.get("challenge_id")
        response = data.get("response")
        if not cid or not challenge_id or not response:
            return jsonify({"ok": False, "msg": "cid, challenge_id, response required"}), 400
        if response not in ("accepted", "declined"):
            return jsonify({"ok": False, "msg": "response must be accepted or declined"}), 400
        with lock:
            for c in challenges:
                if c["id"] == challenge_id:
                    if c["to_cid"] != cid:
                        return jsonify({"ok": False, "msg": "Only the challenged client may respond"}), 403
                    if c["status"] != "pending":
                        return jsonify({"ok": False, "msg": "Challenge already responded"}), 400
                    c["status"] = response
                    c["resp_ts"] = time()
                    # if accepted: optionally reset board or start fresh — keep as is, client will react
                    return jsonify({"ok": True, "challenge": c})
            return jsonify({"ok": False, "msg": "Challenge not found"}), 404
    except Exception:
        log_exception("respond_challenge")
        return jsonify({"ok": False, "msg": "server error"}), 500

@app.route("/debug/stack", methods=["GET"])
def debug_stack():
    import io, threading, traceback
    out = io.StringIO()
    out.write(f"THREAD DUMP at {now()}\n\n")
    for tid, frame in sys._current_frames().items():
        out.write(f"\n--- Thread id: {tid} ---\n")
        for thread in threading.enumerate():
            if thread.ident == tid:
                out.write(f"Name: {thread.name}\n")
                break
        out.write("".join(traceback.format_stack(frame)))
    return out.getvalue(), 200, {"Content-Type": "text/plain; charset=utf-8"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()
    log("Starting XO server on", args.host, args.port)
    app.run(host=args.host, port=args.port, threaded=True)