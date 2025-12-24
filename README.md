# XO Game — Advanced LAN Multiplayer Tic-Tac-Toe
## Real-time, Zero-Lag, Rule-Enhanced XO built with Flask + Modern Web UI
________________________________________
### Overview
**XO Game — LAN Edition** is a modern, feature-packed Tic-Tac-Toe game with unique mechanics, multiplayer LAN support, challenge system, theme switcher, and smooth UI.
Host the game on **Windows** or **Android (Termux) ** and let any device on the same network join instantly.
This project is completely browser-based — no installation needed for players.
________________________________________
### Features
**Game Enhancements**
>  3-copy limit per symbol

>  Automatic removal of the earliest symbol on the 4th copy

>  Anti-tie mechanic

>  Real-time board updates (passive auto-polling)

 **Multiplayer**
>  Supports LAN play between any devices

>  Player roles auto-assigned (X / O)

>  Spectator mode

>  Challenge system (send/receive match invites)

 **UI / UX**
>  6 Themes (Light, Dark, Dark Blue, Solar, Forest, Sunset
> 
>  Confetti Winner Celebration 🎉

>  “Sorry” modal for losing player

>  Highlight of symbol that will be removed next

>  Mobile-responsive grid

>  Smooth animations (pulse, glow, confetti, etc.)

 **Runs Everywhere**
>  Windows

>  Linux

>  Android (Termux) hosting support

>  Works on all modern browsers (Chrome, Firefox, Edge, Mobile)

________________________________________
### Project Structure
```
XO_game/
│
├── static/
│   ├── index.html      # UI & layout 
│   ├── style.css       # Themes & UI styling  
│   └── app.js          # Front-end logic & polling  
│
├── app.py              # Backend Flask server 
└── README.md
```
________________________________________
### Gameplay Rules
**Standard XO Rules**
>  First player to align 3 symbols in a straight line wins.

**Additional Custom Rules**
1.	Only 3 copies of the same symbol may exist on the board
2.	On placing a 4th copy, the earliest placed symbol disappears
3.	Removal cannot occur on the same cell as the earliest symbol
4.	No more draws — the game always proceeds
**Challenge Mode**
>  Players can challenge each other from the lobby
>  Accept/decline prompt
>  On accept → board resets, game starts
________________________________________
### Installation & Running (Windows / Linux)
1. Clone repository
```
git clone https://github.com/ckum0507/XO_game.git
cd XO_game
```
2. Install dependencies
```
pip install flask flask-cors
```
3. Run the server
```
python app.py --host 0.0.0.0 --port 5000
```
4. Open in browser
```
http://localhost:5000/
To join from another device on LAN:
http://<YOUR_PC_IP>:5000/
```
________________________________________
### Running on Android (Termux)
**1. Install Termux (from F-Droid recommended)**

**2. Install packages**
```
pkg update
pkg install python git tmux
```
**3. Clone project**
```
git clone https://github.com/ckum0507/XO_game.git
cd XO_game
```
**4. Run**
```
python app.py --host 0.0.0.0 --port 5000
```
**5. Get phone IP**
```
ip -4 addr show wlan0 | grep inet
```
**6. Join from another phone:**
```
http://<PHONE_IP>:5000/
```
**Recommended (keep server alive):**
```
tmux new -s xo
python app.py --host 0.0.0.0 --port 5000
# detach: CTRL+B then D
```
________________________________________
### Development Notes
Frontend files are pure HTML/CSS/JS served from Flask’s static folder.
Backend is fully thread-safe using threading.Lock().
**Key backend features:**
> Client tracking

> Safe move handling

> Custom rule enforcement

> Challenge management

> Full game reset or board reset
________________________________________
### **Contributing**
Pull requests are welcome!
If you want to contribute:
1.	Fork the repo
2.	Create a new branch (feature/new-feature)
3.	Commit your changes
4.	Submit a PR
________________________________________
### **License**
> This project is licensed under the MIT License.

