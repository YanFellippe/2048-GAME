document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 4;
    const CELL_SIZE = 25; // 25% da largura do container
    const CELL_GAP = 15;
    
    class Game {
        constructor() {
            this.grid = document.querySelector('.grid-background');
            this.cells = Array.from(document.querySelectorAll('.grid-cell'));
            this.tileContainer = document.getElementById('tile-container');
            this.scoreDisplay = document.getElementById('score');
            this.bestScoreDisplay = document.getElementById('best-score');
            this.undoBtn = document.getElementById('undo-btn');
            this.newGameBtn = document.getElementById('new-game-btn');
            this.gameMessage = document.getElementById('game-message');
            this.messageText = this.gameMessage.querySelector('p');
            this.continueBtn = this.gameMessage.querySelector('.continue-btn');
            // Touch no celular
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.touchEndX = 0;
            this.touchEndY = 0;
                        
            this.state = {
                score: 0,
                bestScore: localStorage.getItem('bestScore') || 0,
                grid: [],
                previousStates: [],
                undoCount: 5,
                gameOver: false,
                won: false,
                lastMove: null // Acompanhe a direção do último movimento
            };
            
            this.setup();
            this.setupEventListeners();
        }
        
        setup() {
            // Posicionar células da grade
            this.cells.forEach((cell, index) => {
                const x = index % GRID_SIZE;
                const y = Math.floor(index / GRID_SIZE);
                
                cell.style.width = `calc((100% - ${CELL_GAP * (GRID_SIZE - 1)}px) / ${GRID_SIZE})`;
                cell.style.height = `calc((100% - ${CELL_GAP * (GRID_SIZE - 1)}px) / ${GRID_SIZE})`;
                cell.style.left = `calc(${x} * (100% / ${GRID_SIZE}) + ${x} * ${CELL_GAP}px)`;
                cell.style.top = `calc(${y} * (100% / ${GRID_SIZE}) + ${y} * ${CELL_GAP}px)`;
            });
            
            this.startNewGame();
        }
        
        setupEventListeners() {
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            this.undoBtn.addEventListener('click', this.undoMove.bind(this));
            this.newGameBtn.addEventListener('click', this.startNewGame.bind(this));
            this.continueBtn.addEventListener('click', () => {
                this.gameMessage.classList.add('hidden');
            });
            
            // Eventos de toque para celular
            let touchStartX = 0;
            let touchStartY = 0;
            let touchEndX = 0;
            let touchEndY = 0;
            
            document.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
                this.touchStartY = e.changedTouches[0].screenY;
            }, false);

            document.addEventListener('touchend', (e) => {
                this.touchEndX = e.changedTouches[0].screenX;
                this.touchEndY = e.changedTouches[0].screenY;
                this.handleSwipe();
            }, false);
        }
        
        handleSwipe() {
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) this.moveTiles('right');
                else this.moveTiles('left');
            } else {
                if (dy > 0) this.moveTiles('down');
                else this.moveTiles('up');
            }
        }
        
        handleKeyDown(e) {
            const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if (keys.includes(e.key)) {
                e.preventDefault(); // Impede o scroll
            }
            if (this.state.gameOver) return;
            switch (e.key) {
                case 'ArrowUp':
                    this.moveTiles('up');
                    break;
                case 'ArrowDown':
                    this.moveTiles('down');
                    break;
                case 'ArrowLeft':
                    this.moveTiles('left');
                    break;
                case 'ArrowRight':
                    this.moveTiles('right');
                    break;
            }
        }
        
        startNewGame() {
            this.clearTiles();
            
            this.state = {
                score: 0,
                bestScore: Math.max(this.state.bestScore, localStorage.getItem('bestScore') || 0),
                grid: Array(GRID_SIZE * GRID_SIZE).fill(0),
                previousStates: [],
                undoCount: 5,
                gameOver: false,
                won: false,
                lastMove: null
            };
            
            this.updateScore();
            this.updateUndoButton(); // Usar função centralizada
            this.gameMessage.classList.add('hidden');
            
            // Add 2 initial tiles
            this.addRandomTile(true);
            this.addRandomTile(true);
            
            this.saveState();
        }
        
        saveState() {
            if (this.state.previousStates.length >= 5) {
                this.state.previousStates.shift();
            }

            this.state.previousStates.push({
                grid: [...this.state.grid],
                score: this.state.score,
                gameOver: this.state.gameOver,
                won: this.state.won,
                lastMove: this.state.lastMove
            });
        }        

        undoMove() {
            if (this.state.previousStates.length === 0 || this.state.undoCount <= 0) return;

            const previousState = this.state.previousStates.pop();

            this.state.grid = [...previousState.grid];
            this.state.score = previousState.score;
            this.state.gameOver = previousState.gameOver;
            this.state.won = previousState.won;
            this.state.lastMove = previousState.lastMove;
            this.state.undoCount--; // diminui contagem de reverter movimento

            this.updateScore();
            this.updateUndoButton();
            this.renderTiles();
        }

        updateUndoButton() {
            this.undoBtn.textContent = `Desfazer (${this.state.undoCount})`;
            this.undoBtn.disabled = this.state.undoCount <= 0;
        }
        
        moveTiles(direction) {
            if (this.state.gameOver) return;
            
            // Armazene a direção para animação
            this.state.lastMove = direction;
            
            // Crie uma cópia da grade atual para comparar mais tarde (botão refazer)
            const gridBeforeMove = [...this.state.grid];
            let moved = false;
            let scoreIncrease = 0;
            const mergedPositions = new Set();
            
            // Processar a grade com base na direção
            for (let i = 0; i < GRID_SIZE; i++) {
                const rowOrColumn = this.getRowOrColumn(i, direction);
                const { tiles, mergedScore, merges } = this.slideTiles(rowOrColumn, direction, i);
                scoreIncrease += mergedScore;
                
                // Atualize o jogo com os novos blocos
                this.updateGridWithRowOrColumn(i, tiles, direction, merges, mergedPositions);
                
                // Verifique se alguma peça se moveu
                if (!moved && !this.areEqual(rowOrColumn, tiles)) {
                    moved = true;
                }
            }
            
            // Se as peças forem movidas, adicione uma nova peça aleatória e salve o estado
            if (moved) {
                this.state.score += scoreIncrease;
                if (this.state.score > this.state.bestScore) {
                    this.state.bestScore = this.state.score;
                    localStorage.setItem('bestScore', this.state.bestScore);
                }
                
                this.updateScore();
                this.addRandomTile(true);
                this.saveState();
                this.updateUndoButton();
                
                // Verifique a condição de vitória
                if (!this.state.won && this.state.grid.some(cell => cell === 2048)) {
                    this.state.won = true;
                    this.showMessage('Você venceu!');
                }
                
                // Verifique se o jogo acabou
                if (this.isGameOver()) {
                    this.state.gameOver = true;
                    this.showMessage('Fim de jogo!');
                }
            }
            
            this.renderTiles();
        }
        
        getRowOrColumn(index, direction) {
            const rowOrColumn = [];
            
            for (let i = 0; i < GRID_SIZE; i++) {
                let cellIndex;
                
                switch (direction) {
                    case 'up':
                        cellIndex = i * GRID_SIZE + index;
                        break;
                    case 'down':
                        cellIndex = (GRID_SIZE - 1 - i) * GRID_SIZE + index;
                        break;
                    case 'left':
                        cellIndex = index * GRID_SIZE + i;
                        break;
                    case 'right':
                        cellIndex = index * GRID_SIZE + (GRID_SIZE - 1 - i);
                        break;
                }
                
                rowOrColumn.push(this.state.grid[cellIndex]);
            }
            
            return rowOrColumn;
        }
        
        slideTiles(tiles, direction, rowOrColIndex) {
            const nonZeroTiles = tiles.filter(tile => tile !== 0);
            const newTiles = [];
            let mergedScore = 0;
            const merges = [];
            let skipNext = false;
            
            for (let i = 0; i < nonZeroTiles.length; i++) {
                if (skipNext) {
                    skipNext = false;
                    continue;
                }
                
                if (i < nonZeroTiles.length - 1 && nonZeroTiles[i] === nonZeroTiles[i + 1]) {
                    const mergedValue = nonZeroTiles[i] * 2;
                    newTiles.push(mergedValue);
                    mergedScore += mergedValue;
                    merges.push({ position: newTiles.length - 1, rowOrColIndex, direction });
                    skipNext = true;
                } else {
                    newTiles.push(nonZeroTiles[i]);
                }
            }
            
            // Preencha o restante com zeros
            while (newTiles.length < GRID_SIZE) {
                newTiles.push(0);
            }
            
            return { tiles: newTiles, mergedScore, merges };
        }
        
        updateGridWithRowOrColumn(index, tiles, direction, merges, mergedPositions) {
            for (let i = 0; i < GRID_SIZE; i++) {
                let cellIndex;
                
                switch (direction) {
                    case 'up':
                        cellIndex = i * GRID_SIZE + index;
                        break;
                    case 'down':
                        cellIndex = (GRID_SIZE - 1 - i) * GRID_SIZE + index;
                        break;
                    case 'left':
                        cellIndex = index * GRID_SIZE + i;
                        break;
                    case 'right':
                        cellIndex = index * GRID_SIZE + (GRID_SIZE - 1 - i);
                        break;
                }
                
                // Marcar posições mescladas
                merges.forEach(merge => {
                    let mergeIndex;
                    switch (direction) {
                        case 'up':
                            mergeIndex = merge.position * GRID_SIZE + merge.rowOrColIndex;
                            break;
                        case 'down':
                            mergeIndex = (GRID_SIZE - 1 - merge.position) * GRID_SIZE + merge.rowOrColIndex;
                            break;
                        case 'left':
                            mergeIndex = merge.rowOrColIndex * GRID_SIZE + merge.position;
                            break;
                        case 'right':
                            mergeIndex = merge.rowOrColIndex * GRID_SIZE + (GRID_SIZE - 1 - merge.position);
                            break;
                    }
                    if (cellIndex === mergeIndex) {
                        mergedPositions.add(cellIndex);
                    }
                });
                
                this.state.grid[cellIndex] = tiles[i];
            }
        }
        
        areEqual(arr1, arr2) {
            if (arr1.length !== arr2.length) return false;
            
            for (let i = 0; i < arr1.length; i++) {
                if (arr1[i] !== arr2[i]) return false;
            }
            
            return true;
        }
        
        addRandomTile(isNew = false) {
            const emptyCells = this.state.grid
                .map((value, index) => ({ value, index }))
                .filter(cell => cell.value === 0);
            
            if (emptyCells.length === 0) return;
            
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.state.grid[randomCell.index] = Math.random() < 0.9 ? 2 : 4;
            
            if (isNew) {
                this.state.grid[randomCell.index] = { value: this.state.grid[randomCell.index], isNew: true };
            }
        }
        
        isGameOver() {
            // Verifique se há células vazias
            if (this.state.grid.some(cell => cell === 0 || (typeof cell === 'object' && cell.value === 0))) return false;
            
            // Verifique possíveis fusões em linhas
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE - 1; x++) {
                    const index = y * GRID_SIZE + x;
                    const value1 = typeof this.state.grid[index] === 'object' ? this.state.grid[index].value : this.state.grid[index];
                    const value2 = typeof this.state.grid[index + 1] === 'object' ? this.state.grid[index + 1].value : this.state.grid[index + 1];
                    if (value1 === value2) {
                        return false;
                    }
                }
            }
            
            // Verifique possíveis fusões em colunas
            for (let x = 0; x < GRID_SIZE; x++) {
                for (let y = 0; y < GRID_SIZE - 1; y++) {
                    const index = y * GRID_SIZE + x;
                    const value1 = typeof this.state.grid[index] === 'object' ? this.state.grid[index].value : this.state.grid[index];
                    const value2 = typeof this.state.grid[index + GRID_SIZE] === 'object' ? this.state.grid[index + GRID_SIZE].value : this.state.grid[index + GRID_SIZE];
                    if (value1 === value2) {
                        return false;
                    }
                }
            }
            
            return true;
        }
        
        renderTiles() {
            this.clearTiles();
            const mergedPositions = new Set();
            
            // Rastrear posições anteriores para animação de movimento
            const previousTiles = new Map();
            if (this.state.lastMove) {
                const previousState = this.state.previousStates[this.state.previousStates.length - 1];
                if (previousState) {
                    previousState.grid.forEach((value, index) => {
                        if (value !== 0) {
                            previousTiles.set(index, { value, x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) });
                        }
                    });
                }
            }
            
            this.state.grid.forEach((cell, index) => {
                let value = cell;
                let isNew = false;
                
                if (typeof cell === 'object') {
                    value = cell.value;
                    isNew = cell.isNew || false;
                }
                
                if (value === 0) return;
                
                const x = index % GRID_SIZE;
                const y = Math.floor(index / GRID_SIZE);
                
                const tile = document.createElement('div');
                tile.classList.add('tile');
                tile.classList.add(`tile-${value}`);
                
                if (value > 2048) {
                    tile.classList.add('tile-super');
                }
                
                if (isNew) {
                    tile.classList.add('tile-new');
                }
                
                // Verifique se este bloco foi mesclado
                const isMerged = this.state.previousStates.length > 0 && this.state.lastMove &&
                    this.wasMerged(index, value, this.state.previousStates[this.state.previousStates.length - 1].grid);
                
                if (isMerged && !mergedPositions.has(index)) {
                    // Força reflow e reaplica a classe para garantir animação
                    tile.classList.add('tile-merged');
                    tile.addEventListener('animationend', () => {
                        tile.classList.remove('tile-merged');
                    }, { once: true });

                    mergedPositions.add(index);
                }
                                
                tile.textContent = value;
                
                // Usar posicionamento de grade
                tile.style.gridColumn = x + 1;
                tile.style.gridRow = y + 1;
                
                this.tileContainer.appendChild(tile);
                
                // Redefinir o sinalizador isNew após a renderização
                if (isNew) {
                    this.state.grid[index] = value;
                }
            });
        }
        
        wasMerged(currentIndex, currentValue, previousGrid) {
            // Detecção de mesclagem simplificada: verifique se o valor do bloco não pode ter vindo de um único bloco no estado anterior
            const prevValue = previousGrid[currentIndex];
            if (prevValue === currentValue) return false; // No merge if value unchanged
            
            // Verifique se esta posição pode ser resultado de uma fusão
            const x = currentIndex % GRID_SIZE;
            const y = Math.floor(currentIndex / GRID_SIZE);
            
            const halfValue = currentValue / 2;
            let possibleSources = 0;
            
            // Verifique as posições adjacentes na direção do último movimento
            if (this.state.lastMove) {
                switch (this.state.lastMove) {
                    case 'up':
                        if (y < GRID_SIZE - 1) {
                            if (previousGrid[currentIndex + GRID_SIZE] === halfValue) possibleSources++;
                            if (y < GRID_SIZE - 2 && previousGrid[currentIndex + 2 * GRID_SIZE] === halfValue) possibleSources++;
                        }
                        break;
                    case 'down':
                        if (y > 0) {
                            if (previousGrid[currentIndex - GRID_SIZE] === halfValue) possibleSources++;
                            if (y > 1 && previousGrid[currentIndex - 2 * GRID_SIZE] === halfValue) possibleSources++;
                        }
                        break;
                    case 'left':
                        if (x < GRID_SIZE - 1) {
                            if (previousGrid[currentIndex + 1] === halfValue) possibleSources++;
                            if (x < GRID_SIZE - 2 && previousGrid[currentIndex + 2] === halfValue) possibleSources++;
                        }
                        break;
                    case 'right':
                        if (x > 0) {
                            if (previousGrid[currentIndex - 1] === halfValue) possibleSources++;
                            if (x > 1 && previousGrid[currentIndex - 2] === halfValue) possibleSources++;
                        }
                        break;
                }
            }
            
            return possibleSources >= 2;
        }
        
        clearTiles() {
            while (this.tileContainer.firstChild) {
                this.tileContainer.removeChild(this.tileContainer.firstChild);
            }
        }
        
        updateScore() {
            this.scoreDisplay.textContent = this.state.score;
            this.bestScoreDisplay.textContent = this.state.bestScore;
        }
        
        showMessage(text) {
            this.messageText.textContent = text;
            this.gameMessage.classList.remove('hidden');
        }
    }
    // Inicia um jogo novo
    new Game();
});