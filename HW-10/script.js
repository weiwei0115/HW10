(() => {
    // ===== Constants =====
    const EMPTY = 0, BLACK = 1, WHITE = 2;
    const DIRS = [
      [-1,-1],[-1,0],[-1,1],
      [0,-1],        [0,1],
      [1,-1],[1,0],[1,1]
    ];
  
    // Advanced heuristic weights (classic Othello)
    const W = [
      [120, -20,  20,   5,   5,  20, -20, 120],
      [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
      [ 20,  -5,  15,   3,   3,  15,  -5,  20],
      [  5,  -5,   3,   3,   3,   3,  -5,   5],
      [  5,  -5,   3,   3,   3,   3,  -5,   5],
      [ 20,  -5,  15,   3,   3,  15,  -5,  20],
      [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
      [120, -20,  20,   5,   5,  20, -20, 120]
    ];
  
    // ===== DOM =====
    const boardEl = document.getElementById("board");
    const difficultyEl = document.getElementById("difficulty");
    const restartBtn = document.getElementById("restartBtn");
    const hintBtn = document.getElementById("hintBtn");
    const turnTextEl = document.getElementById("turnText");
    const phasePillEl = document.getElementById("phasePill");
    const blackScoreEl = document.getElementById("blackScore");
    const whiteScoreEl = document.getElementById("whiteScore");
    const logArea = document.getElementById("logArea");
  
    // ===== State =====
    let board = makeEmptyBoard();
    let turn = BLACK;            // user starts (BLACK)
    let thinking = false;        // lock during animations/AI
    let showHints = true;
  
    // ===== Init =====
    buildBoardUI();
    resetGame();
  
    restartBtn.addEventListener("click", resetGame);
    hintBtn.addEventListener("click", () => {
      showHints = !showHints;
      hintBtn.classList.toggle("on", showHints);
      render();
    });
  
    // ===== Board helpers =====
    function makeEmptyBoard(){
      return Array.from({length:8}, () => Array(8).fill(EMPTY));
    }
  
    function resetGame(){
      board = makeEmptyBoard();
      // initial 4 discs
      board[3][3] = WHITE;
      board[3][4] = BLACK;
      board[4][3] = BLACK;
      board[4][4] = WHITE;
  
      turn = BLACK;
      thinking = false;
      clearLog();
      log("新局開始：你是黑棋先手。");
      render();
      maybeAutoPassOrAIMove(); // in case
    }
  
    function buildBoardUI(){
      boardEl.innerHTML = "";
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
          cell.addEventListener("click", onCellClick);
          boardEl.appendChild(cell);
        }
      }
    }
  
    // ===== Move generation =====
    function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
    function opponent(p){ return p===BLACK ? WHITE : BLACK; }
  
    function getFlips(b, r, c, player){
      if(b[r][c] !== EMPTY) return [];
      const opp = opponent(player);
      const flips = [];
  
      for(const [dr,dc] of DIRS){
        let rr = r + dr, cc = c + dc;
        const line = [];
        while(inBounds(rr,cc) && b[rr][cc] === opp){
          line.push([rr,cc]);
          rr += dr; cc += dc;
        }
        if(line.length>0 && inBounds(rr,cc) && b[rr][cc] === player){
          flips.push(...line);
        }
      }
      return flips;
    }
  
    function getValidMoves(b, player){
      const moves = [];
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          const flips = getFlips(b,r,c,player);
          if(flips.length>0) moves.push({r,c,flips});
        }
      }
      return moves;
    }
  
    function applyMove(b, move, player){
      const nb = cloneBoard(b);
      nb[move.r][move.c] = player;
      for(const [fr,fc] of move.flips) nb[fr][fc] = player;
      return nb;
    }
  
    function cloneBoard(b){
      return b.map(row => row.slice());
    }
  
    function countScore(b){
      let black=0, white=0;
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          if(b[r][c]===BLACK) black++;
          else if(b[r][c]===WHITE) white++;
        }
      }
      return {black,white};
    }
  
    function isGameOver(b){
      return getValidMoves(b,BLACK).length===0 && getValidMoves(b,WHITE).length===0;
    }
  
    // ===== UI render =====
    function render(){
      const valid = getValidMoves(board, turn);
      const cells = boardEl.querySelectorAll(".cell");
  
      // update text
      turnTextEl.textContent = (turn===BLACK) ? "黑棋（你）" : "白棋（電腦）";
      phasePillEl.textContent = thinking ? "處理中" : "等待落子";
  
      const sc = countScore(board);
      blackScoreEl.textContent = sc.black;
      whiteScoreEl.textContent = sc.white;
  
      // paint each cell
      cells.forEach(cell => {
        const r = Number(cell.dataset.r);
        const c = Number(cell.dataset.c);
  
        cell.innerHTML = ""; // clear disc/hint
  
        // disc
        if(board[r][c] === BLACK || board[r][c] === WHITE){
          const d = document.createElement("div");
          d.className = "disc " + (board[r][c]===BLACK ? "black" : "white");
          cell.appendChild(d);
        }
  
        // hint
        if(showHints && !thinking && turn===BLACK){
          // show hints only for user to avoid clutter
          const isValid = valid.some(m => m.r===r && m.c===c);
          if(isValid){
            const h = document.createElement("div");
            h.className = "hint";
            cell.appendChild(h);
          }
        }
      });
  
      if(isGameOver(board)){
        const {black,white} = countScore(board);
        if(black>white) log(`遊戲結束：你贏了（黑 ${black} : 白 ${white}）`);
        else if(white>black) log(`遊戲結束：電腦贏了（黑 ${black} : 白 ${white}）`);
        else log(`遊戲結束：平手（黑 ${black} : 白 ${white}）`);
      }
    }
  
    // ===== Click handling (User move) =====
    async function onCellClick(e){
      if(thinking) return;
      if(turn !== BLACK) return; // user only plays black
      if(isGameOver(board)) return;
  
      const r = Number(e.currentTarget.dataset.r);
      const c = Number(e.currentTarget.dataset.c);
  
      const flips = getFlips(board, r, c, BLACK);
      if(flips.length===0) return;
  
      thinking = true;
      render();
  
      await placeAndFlipSequential(r, c, flips, BLACK);
      log(`你下在 (${r+1},${c+1})，翻 ${flips.length} 顆`);
  
      endTurn();
    }
  
    function endTurn(){
      turn = opponent(turn);
      thinking = false;
      render();
      maybeAutoPassOrAIMove();
    }
  
    // ===== Auto pass / AI move =====
    async function maybeAutoPassOrAIMove(){
      if(isGameOver(board)) return;
  
      const valid = getValidMoves(board, turn);
      if(valid.length === 0){
        log(`${turn===BLACK ? "你" : "電腦"}無合法步，Pass。`);
        turn = opponent(turn);
        render();
        // continue in case of consecutive pass
        setTimeout(maybeAutoPassOrAIMove, 50);
        return;
      }
  
      // AI move if white turn
      if(turn === WHITE){
        thinking = true;
        render();
        setTimeout(async () => {
          const move = chooseAIMove(board);
          if(!move){
            // should not happen if valid>0
            thinking = false;
            render();
            return;
          }
          await placeAndFlipSequential(move.r, move.c, move.flips, WHITE);
          log(`電腦下在 (${move.r+1},${move.c+1})，翻 ${move.flips.length} 顆`);
          turn = BLACK;
          thinking = false;
          render();
          // if user has no move, auto-pass again
          maybeAutoPassOrAIMove();
        }, 250);
      }
    }
  
    // ===== Sequential flip animation =====
    function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }
  
    async function placeAndFlipSequential(r, c, flips, player){
      // 1) Place disc immediately
      board[r][c] = player;
      render();
  
      // 2) Flip in sequence: show flipping animation per disc
      for(const [fr,fc] of flips){
        const cell = getCell(fr, fc);
        const disc = cell.querySelector(".disc");
        if(disc){
          disc.classList.add("flipping");
          await sleep(210); // mid animation
        }
        board[fr][fc] = player;
        render();
        await sleep(70);
      }
    }
  
    function getCell(r,c){
      return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    }
  
    // ===== AI =====
    function chooseAIMove(b){
      const moves = getValidMoves(b, WHITE);
      if(moves.length===0) return null;
  
      const mode = difficultyEl.value;
      if(mode === "basic"){
        // Greedy: maximize flips; tie-break by corners, then random
        moves.sort((a,bm) => bm.flips.length - a.flips.length);
        const bestLen = moves[0].flips.length;
        const top = moves.filter(m => m.flips.length===bestLen);
        // prefer corner if exists
        const corner = top.find(m => isCorner(m.r,m.c));
        return corner || top[Math.floor(Math.random()*top.length)];
      }else{
        // Advanced: minimax depth 3 with alpha-beta + evaluation
        const depth = 3;
        let best = null;
        let bestScore = -Infinity;
  
        for(const m of moves){
          const nb = applyMove(b, m, WHITE);
          const s = minimax(nb, depth-1, -Infinity, Infinity, false);
          if(s > bestScore){
            bestScore = s;
            best = m;
          }
        }
        return best;
      }
    }
  
    function isCorner(r,c){
      return (r===0 && c===0) || (r===0 && c===7) || (r===7 && c===0) || (r===7 && c===7);
    }
  
    function minimax(b, depth, alpha, beta, maximizingWhite){
      if(depth===0 || isGameOver(b)){
        return evaluate(b);
      }
  
      const player = maximizingWhite ? WHITE : BLACK;
      const moves = getValidMoves(b, player);
  
      // Pass handling
      if(moves.length===0){
        return minimax(b, depth-1, alpha, beta, !maximizingWhite);
      }
  
      if(maximizingWhite){
        let value = -Infinity;
        for(const m of moves){
          const nb = applyMove(b, m, WHITE);
          value = Math.max(value, minimax(nb, depth-1, alpha, beta, false));
          alpha = Math.max(alpha, value);
          if(alpha >= beta) break;
        }
        return value;
      }else{
        let value = Infinity;
        for(const m of moves){
          const nb = applyMove(b, m, BLACK);
          value = Math.min(value, minimax(nb, depth-1, alpha, beta, true));
          beta = Math.min(beta, value);
          if(alpha >= beta) break;
        }
        return value;
      }
    }
  
    function evaluate(b){
      // score from WHITE perspective (positive => good for AI)
      let pos = 0;
      let white=0, black=0;
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          if(b[r][c]===WHITE){ pos += W[r][c]; white++; }
          else if(b[r][c]===BLACK){ pos -= W[r][c]; black++; }
        }
      }
  
      // Mobility
      const mw = getValidMoves(b, WHITE).length;
      const mb = getValidMoves(b, BLACK).length;
      const mobility = 8 * (mw - mb);
  
      // Disc diff (late game matters more). Simple scaling by empties.
      let empties = 64 - (white + black);
      const phase = empties / 64; // early ~1, late ~0
      const discDiff = (white - black) * (phase < 0.35 ? 6 : 1.5);
  
      // Corner occupancy
      const corners = [[0,0],[0,7],[7,0],[7,7]];
      let cornerScore = 0;
      for(const [r,c] of corners){
        if(b[r][c]===WHITE) cornerScore += 30;
        else if(b[r][c]===BLACK) cornerScore -= 30;
      }
  
      return pos + mobility + discDiff + cornerScore;
    }
  
    // ===== Logging =====
    function log(msg){
      const div = document.createElement("div");
      div.className = "line";
      div.textContent = msg;
      logArea.prepend(div);
    }
    function clearLog(){ logArea.innerHTML = ""; }
  })();
  