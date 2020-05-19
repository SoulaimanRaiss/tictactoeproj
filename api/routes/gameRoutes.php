<?php
$routes[] = [
    'url' => 'v1\/games',
    'method' => 'post',
    'callback' => function($args) {
        return Game::create();
    }
];

$routes[] = [
    'url' => 'v1\/games\/(\w+)',
    'argNames' => ['gameID'],
    'method' => 'get',
    'callback' => function($args) {
        $game = Game::load($args['gameID']);
        if ($game instanceof Game) {
            $game = $game->getGameStatus();
        }
        return $game;
    }
];

$routes[] = [
    'url' => 'v1\/games\/(\w+)\/join',
    'argNames' => ['gameID'],
    'method' => 'post',
    'callback' => function($args) {
        $game = Game::load($args['gameID']);
        if ($game instanceof Game) {
            $game->join();
            return $game->getGameStatus();
        }
        return $game;
    }
];

$routes[] = [
    'url' => 'v1\/games\/(\w+)\/makeMove',
    'argNames' => ['gameID'],
    'method' => 'post',
    'callback' => function($args, $payload) {
        $row = filter_var($payload['row'] ?? null, FILTER_VALIDATE_INT);
        $col = filter_var($payload['col'] ?? null, FILTER_VALIDATE_INT);

        if ($col === false || $row === false) {
            http_response_code(400);
            throw new Exception('Incomplete request, expected parameters: row, col');
        }

        $game = Game::load($args['gameID']);
        if ($game instanceof Game) {
            $game = $game->makeMove($row, $col);
            return $game;
        }
        return null;
    }
];
