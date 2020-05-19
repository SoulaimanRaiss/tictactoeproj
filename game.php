<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tic Tac Toe - Game</title>
    <?php include 'head.html'?>
</head>
<body data-page="game">
    <header>
        <h1>Tic Tac Toe</h1>
    </header>
    <main>
        <section id="join-header">
            <h2 id="join-message-title">Verifying game</h2>
            <h3 id="join-message">Please wait while we verify the requested game</h3>
            <button id="join-button" disabled>Ready</button>
        </section>

        <section id="game">
            <h1 id="game-status">Waiting for guest</h1>
            <canvas id="game-grid"></canvas>
        </section>
    </main>
    <script src="main.js"></script>
</body>
</html>