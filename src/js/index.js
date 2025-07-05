document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 4;
    const CELL_SIZE = 25; // 25% of container width
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
            
            this.state = {
                score: 0,
                bestScore: localStorage.getItem('bestScore') || 0,
                grid: [],
                previousStates: [],
                undoCount: 5,
                gameOver: false,
                won: false,
                lastMove: null // Track last move direction
            };
            
            this.setup();
            this.setupEventListeners();
        }
        
        setup() {
            // Position grid cells
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
            
            // Touch events for mobile
            let touchStartX = 0;
            let touchStartY = 0;
            let touchEndX = 0;
            let touchEndY = 0;
            
            document.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, false);
            
            document.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
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
            this.undoBtn.disabled = true;
            this.undoBtn.textContent = `Desfazer (${this.state.undoCount})`;
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
                undoCount: this.state.undoCount,
                gameOver: this.state.gameOver,
                won: this.state.won,
                lastMove: this.state.lastMove
            });
        }
        
        undoMove() {
            if (this.state.previousStates.length === 0 || this.state.undoCount <= 0) return;
            
            const previousState = this.state.previousStates.pop();
            
            this.state.grid = previousState.grid;
            this.state.score = previousState.score;
            this.state.undoCount = previousState.undoCount - 1;
            this.state.gameOver = previousState.gameOver;
            this.state.won = previousState.won;
            this.state.lastMove = previousState.lastMove;
            
            this.updateScore();
            this.updateUndoButton();
            this.renderTiles();
            
            if (this.state.undoCount <= 0) {
                this.undoBtn.disabled = true;
            }
        }
        
        updateUndoButton() {
            this.undoBtn.textContent = `Desfazer (${this.state.undoCount})`;
            this.undoBtn.disabled = this.state.undoCount <= 0;
        }
        
        moveTiles(direction) {
            if (this.state.gameOver) return;
            
            // Store the direction for animation
            this.state.lastMove = direction;
            
            // Create a copy of the current grid to compare later
            const gridBeforeMove = [...this.state.grid];
            let moved = false;
            let scoreIncrease = 0;
            const mergedPositions = new Set();
            
            // Process the grid based on direction
            for (let i = 0; i < GRID_SIZE; i++) {
                const rowOrColumn = this.getRowOrColumn(i, direction);
                const { tiles, mergedScore, merges } = this.slideTiles(rowOrColumn, direction, i);
                scoreIncrease += mergedScore;
                
                // Update the grid with the new tiles
                this.updateGridWithRowOrColumn(i, tiles, direction, merges, mergedPositions);
                
                // Check if any tile moved
                if (!moved && !this.areEqual(rowOrColumn, tiles)) {
                    moved = true;
                }
            }
            
            // If tiles moved, add a new random tile and save state
            if (moved) {
                this.state.score += scoreIncrease;
                if (this.state.score > this.state.bestScore) {
                    this.state.bestScore = this.state.score;
                    localStorage.setItem('bestScore', this.state.bestScore);
                }
                
                this.updateScore();
                this.addRandomTile(true);
                this.saveState();
                this.state.undoCount = 5;
                this.updateUndoButton();
                
                // Check for win condition
                if (!this.state.won && this.state.grid.some(cell => cell === 2048)) {
                    this.state.won = true;
                    this.showMessage('Você venceu!');
                }
                
                // Check for game over
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
            
            // Fill the rest with zeros
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
                
                // Mark merged positions
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
            // Check if there are empty cells
            if (this.state.grid.some(cell => cell === 0 || (typeof cell === 'object' && cell.value === 0))) return false;
            
            // Check for possible merges in rows
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
            
            // Check for possible merges in columns
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
            
            // Track previous positions for movement animation
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
                
                // Check if this tile was merged
                const isMerged = this.state.previousStates.length > 0 && this.state.lastMove &&
                    this.wasMerged(index, value, this.state.previousStates[this.state.previousStates.length - 1].grid);
                
                if (isMerged && !mergedPositions.has(index)) {
                    tile.classList.add('tile-merged');
                    mergedPositions.add(index);
                }
                
                tile.textContent = value;
                
                // Use grid positioning
                tile.style.gridColumn = x + 1;
                tile.style.gridRow = y + 1;
                
                this.tileContainer.appendChild(tile);
                
                // Reset isNew flag after rendering
                if (isNew) {
                    this.state.grid[index] = value;
                }
            });
        }
        
        wasMerged(currentIndex, currentValue, previousGrid) {
            // Simplified merge detection: check if the tile's value couldn't have come from a single tile in the previous state
            const prevValue = previousGrid[currentIndex];
            if (prevValue === currentValue) return false; // No merge if value unchanged
            
            // Check if this position could be the result of a merge
            const x = currentIndex % GRID_SIZE;
            const y = Math.floor(currentIndex / GRID_SIZE);
            
            const halfValue = currentValue / 2;
            let possibleSources = 0;
            
            // Check adjacent positions in the direction of the last move
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
    
    // Initialize the game
    new Game();
});