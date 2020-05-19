const apiUrl = '/api/v1';
const DONE = XMLHttpRequest.DONE;

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results || !results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function apiRequest(method, endpoint, payload = null, supportedStates = []) {
    const url = apiUrl + '/' + endpoint;

    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    return new Promise(function (resolve, reject) {
        xhr.onreadystatechange = function () {
            if (xhr.readyState === DONE) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.error != null) {
                        if (!supportedStates.includes(xhr.status))
                        {
                            reject({error: data.error, status: xhr.status});
                        }
                        else
                        {
                            resolve({error: data.error, status: xhr.status});
                        }
                    }
                    else {
                        resolve({payload: data.payload, status: xhr.status});
                    }
                }
                catch (e) {
                    reject({error: 'Invalid server response.', status: xhr.status});
                }
            }
        };
        if (method !== 'get') {
            if (payload !== null) {
                if (payload.payload !== null) {
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify(payload));
                }
                else {
                    reject('Invalid payload supplied');
                }
            }
            else {
                xhr.send();
            }
        }
        else
        {
            xhr.send();
        }
    });
}

(async function () {
    async function createGame() {
        try {
            const response = await apiRequest('post', 'games');
            if (response.status === 200) {
                location.href = 'game.php?i=' + response.payload.id;
            }
        }
        catch (e) {
            alert(e.error);
        }
    }

    const body = document.body;
    switch (body.dataset.page) {
        case 'index': {
            const startGame = document.getElementById('start-game');
            startGame.addEventListener('click', async function () {
                await createGame();
            });

            break;
        }
        case 'game' : {
            const grid = document.getElementById('game-grid');
            const joinHeader = document.getElementById('join-header');
            const joinButton = document.getElementById('join-button');
            const joinMessageTitle = document.getElementById('join-message-title');
            const joinMessage = document.getElementById('join-message');
            const gameStatusLabel = document.getElementById('game-status');
            let gameState = null;
            let gameID = getParameterByName('i').trim();
            let joinButtonHandler = null;
            let interval = null;

            function shouldPollServer() {
                return gameState !== null && ((!gameState.myTurn || !gameState.spectating) || (gameState.spectating)) && (gameState.status !== 2) && body.classList.contains('started');
            }

            function stopPolling(error) {
                clearInterval(interval);
                alert(error);
            }

            async function pollServer() {
                if (shouldPollServer()) {
                    try {
                        const response = await apiRequest('get', 'games/' + gameID);
                        if (response.status === 200) {
                            gameState = response.payload;
                            showGame();
                        }
                    }
                    catch (e) {
                        stopPolling(e.error);
                        body.classList.remove('started');

                        joinMessageTitle.innerHTML = 'Something happened';
                        joinMessage.innerHTML = 'It appears there was an error, try <strong>refreshing</strong> the page.';
                        joinButton.disabled = false;
                        joinButton.innerHTML = 'Refresh';

                        joinButtonHandler = async function () {
                            location.reload();
                        }
                    }
                }
            }

            function startPolling() {
                interval = setInterval(async function () {
                    await pollServer();
                }, 1000);
            }

            function showGame() {
                body.classList.add('started');
                drawGame(gameState);
            }

            async function joinGame() {
                try {
                    const response = await apiRequest('post', 'games/' + gameID + '/join');
                    if (response.status === 200) {
                        gameState = response.payload;
                        showGame();
                    }
                }
                catch (e) {
                    alert(e.error);
                }
            }

            if (gameID !== '') {
                try {
                    const response = await apiRequest('get', 'games/' + gameID);
                    if (response.status === 200) {
                        gameState = response.payload;
                        if (gameState.canJoin) {
                            joinMessageTitle.innerHTML = 'Everything\'s set!';
                            joinMessage.innerHTML = 'Click <strong>ready</strong> to join the game!';
                            joinButton.disabled = false;

                            joinButton.innerHTML = 'Ready';
                            joinButtonHandler = joinGame;
                        }
                        else if (gameState.spectating) {
                            joinMessageTitle.innerHTML = 'Spectator mode';
                            joinMessage.innerHTML = 'It appears you cannot join, but you can click <strong>spectate</strong> to spectate the game!';
                            joinButton.disabled = false;
                            joinButton.innerHTML = 'Spectate';

                            joinButtonHandler = async function () {
                                showGame();
                            }
                        }
                        else if (!gameState.spectating) {
                            showGame();
                        }
                    }
                    else if (response.status === 404) {
                        joinMessageTitle.innerHTML = 'Could not find game';
                        joinMessage.innerHTML = 'It appears you have followed an invalid URL. Press <strong>start</strong> to start a new game!';
                        joinButton.disabled = false;
                        joinButton.innerHTML = 'Start';

                        joinButtonHandler = createGame;
                    }
                }
                catch (e) {
                    alert(e.error);
                }
            }
            else
            {
                joinMessageTitle.innerHTML = 'No game ID supplied!';
                joinMessage.innerHTML = 'It appears you have followed an invalid URL. Press <strong>start</strong> to start a new game!';
                joinButton.disabled = true;
                joinButton.innerHTML = 'Start';
            }

            joinButton.addEventListener('click', async function () {
                if (joinButtonHandler !== null)
                {
                    await joinButtonHandler();
                }
            });

            function drawGame(gameState, e, resize = true) {
                if (gameState == null || !body.classList.contains('started')) {
                    return;
                }

                if (gameState.status === 0) {
                    gameStatusLabel.innerHTML = 'Waiting for players';
                }
                else if (gameState.status === 1) {
                    if (gameState.spectating) {
                        gameStatusLabel.innerHTML = 'Spectating';
                    }
                    else if (gameState.myTurn) {
                        gameStatusLabel.innerHTML = 'Your turn';
                    }
                    else {
                        gameStatusLabel.innerHTML = 'Their turn';
                    }
                }
                else {
                    if (gameState.winType === 2) {
                        gameStatusLabel.innerHTML = 'Tie!';
                    }
                    else if (gameState.spectating) {
                        gameStatusLabel.innerHTML = (gameState.winner === 0 ? 'X' : 'O') + ' wins!';
                    }
                    else
                    {
                        if (gameState.won) {
                            gameStatusLabel.innerHTML = 'You won!';
                        }
                        else {
                            gameStatusLabel.innerHTML = 'You lost';
                        }
                    }

                    joinHeader.style.display = 'block';
                    joinMessageTitle.innerHTML = 'Game ended!';
                    joinMessage.innerHTML = 'This game has ended! Press <strong>start</strong> to start a new one!';
                    joinButton.disabled = false;
                    joinButton.innerHTML = 'Start';

                    joinButtonHandler = createGame;
                }

                const rect = grid.getBoundingClientRect();
                let width;
                let height;
                if (resize) {
                    width = grid.width = rect.width;
                    height = grid.height = rect.height;
                }
                else {
                    width = grid.width;
                    height = grid.height;
                }
                const margin = height / 20;
                const xOffset = margin;
                const yOffset = margin;
                width -= margin * 2;
                height -= margin * 2;

                const ctx = grid.getContext('2d');

                ctx.clearRect(0, 0, width, height);

                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--main-color');
                ctx.globalAlpha = 0.2;
                ctx.lineWidth = height / 100;

                for (let i = 0; i < 2; i++) {
                    ctx.beginPath();
                    ctx.moveTo(xOffset + width / 3 * (i + 1), yOffset);
                    ctx.lineTo(xOffset + width / 3 * (i + 1), yOffset + height);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(xOffset, yOffset + height / 3 * (i + 1));
                    ctx.lineTo(xOffset + width, yOffset + height / 3 * (i + 1));
                    ctx.stroke();
                }

                ctx.globalAlpha = 1;

                const cellMargin = margin / 1.5;
                const cellWidth = width / 3 - cellMargin * 2;
                const cellHeight = height / 3 - cellMargin * 2;

                const gridString = gameState.grid;
                for (let i = 0; i < gridString.length; i++) {
                    const symbol = gridString[i];
                    const y = Math.floor(i / 3);
                    const x = i - (3 * y);
                    const cellX = xOffset + (width / 3) * x;
                    const cellY = yOffset + (height / 3) * y;

                    const startCellX = cellX + cellMargin;
                    const startCellY = cellY + cellMargin;
                    const endCellX = startCellX + cellWidth;
                    const endCellY = startCellY + cellHeight;

                    switch (symbol.toUpperCase()) {
                        case 'X': {
                            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--main-color');
                            ctx.lineWidth = cellWidth / 10;

                            ctx.beginPath();
                            ctx.moveTo(startCellX + ctx.lineWidth / 2, startCellY + ctx.lineWidth / 2);
                            ctx.lineTo(endCellX - ctx.lineWidth / 2, endCellY - ctx.lineWidth / 2);
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(startCellX + cellWidth - ctx.lineWidth / 2, startCellY + ctx.lineWidth / 2);
                            ctx.lineTo(endCellX - cellWidth + ctx.lineWidth / 2, endCellY - ctx.lineWidth / 2);
                            ctx.stroke();
                            break;
                        }
                        case 'O': {
                            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--alert-color');
                            ctx.lineWidth = cellWidth / 10;

                            ctx.beginPath();
                            ctx.arc(startCellX + cellWidth / 2, startCellY + cellHeight / 2, cellWidth / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
                            ctx.stroke();
                            break;
                        }
                    }
                }

                if (gameState.status === 2) {
                    const winningLine = gameState.winningLine;
                    if (winningLine != null) {
                        ctx.globalAlpha = 0.5;
                        const startCellX = xOffset + (width / 3) * winningLine[0].col;
                        const startCellY = xOffset + (height / 3) * winningLine[0].row;
                        const endCellX = xOffset + (width / 3) * winningLine[1].col;
                        const endCellY = xOffset + (height / 3) * winningLine[1].row;
                        const winningLineStartX = startCellX + cellMargin + cellWidth / 2;
                        const winningLineStartY = startCellY + cellMargin + cellWidth / 2;
                        const winningLineEndX = endCellX + cellWidth / 2 + cellMargin;
                        const winningLineEndY = endCellY + cellWidth / 2 + cellMargin;

                        ctx.strokeStyle = 'black';
                        ctx.beginPath();
                        ctx.moveTo(winningLineStartX, winningLineStartY);
                        ctx.lineTo(winningLineEndX, winningLineEndY);
                        ctx.stroke();
                    }
                }
                else if (e != null && gameState.status === 1 && gameState.myTurn && !gameState.spectating) {
                    ctx.globalAlpha = 0.2;
                    ctx.fillStyle = 'white';
                    for (let i = 0; i < 9; i++) {
                        if (gridString[i] !== ' ') {
                            continue;
                        }

                        const y = Math.floor(i / 3);
                        const x = i - (3 * y);
                        const cellX = xOffset + (width / 3) * x;
                        const cellY = xOffset + (height / 3) * y;

                        const startCellX = cellX + cellMargin;
                        const startCellY = cellY + cellMargin;
                        const endCellX = startCellX + cellWidth;
                        const endCellY = startCellY + cellHeight;

                        let mouseX = e.clientX - rect.left;
                        let mouseY = e.clientY - rect.top;

                        if (mouseX >= startCellX && mouseY >= startCellY && mouseX <= endCellX && mouseY <= endCellY) {
                            ctx.beginPath();
                            ctx.arc(startCellX + cellWidth / 2, startCellY + cellHeight / 2, cellWidth / 2, 0, Math.PI * 2);
                            ctx.fill();
                            break;
                        }
                    }
                }
            }

            async function makeMove(e, touch = false) {
                if (e == null || gameState.spectating || !gameState.myTurn || gameState.status !== 1) {
                    return;
                }

                const rect = grid.getBoundingClientRect();
                const gridString = gameState.grid;
                let width = grid.width;
                let height = grid.height;
                const margin = height / 20;
                const xOffset = margin;
                const yOffset = margin;
                const cellMargin = margin / 1.5;
                const cellWidth = width / 3 - cellMargin * 2;
                const cellHeight = height / 3 - cellMargin * 2;
                width -= margin * 2;
                height -= margin * 2;

                for (let i = 0; i < 9; i++) {
                    if (gridString[i] !== ' ') {
                        continue;
                    }

                    const y = Math.floor(i / 3);
                    const x = i - (3 * y);
                    const cellX = xOffset + (width / 3) * x;
                    const cellY = yOffset + (height / 3) * y;

                    const startCellX = cellX + cellMargin;
                    const startCellY = cellY + cellMargin;
                    const endCellX = startCellX + cellWidth;
                    const endCellY = startCellY + cellHeight;

                    let mouseX;
                    let mouseY;

                    if (touch) {
                        const touch = e.targetTouches[0];
                        mouseX = touch.clientX - rect.left;
                        mouseY = touch.clientY - rect.top;
                    }
                    else {
                        mouseX = e.clientX - rect.left;
                        mouseY = e.clientY - rect.top;
                    }

                    if (mouseX >= startCellX && mouseY >= startCellY && mouseX <= endCellX && mouseY <= endCellY) {
                        try {
                            const response = await apiRequest('post', 'games/' + gameID + '/makeMove', {payload: {row: y, col: x}});
                            if (response.status === 200) {
                                gameState = response.payload;
                                drawGame(gameState);
                            }
                        }
                        catch (error) {
                            alert(error.error);
                        }
                        break;
                    }
                }
            }

            grid.addEventListener('mousemove', function (e) { drawGame(gameState, e) });
            grid.addEventListener('mousedown', function (e) { makeMove(e) });
            grid.addEventListener('touchstart', function (e) { makeMove(e, true) });
            window.addEventListener('resize', function () { drawGame(gameState, null, true) });

            startPolling();
            break;
        }
    }
})();