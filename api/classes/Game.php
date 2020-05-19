<?php
class Game implements JsonSerializable {
    const GamesFolder = __DIR__ . '/../../games';
    const StartingGrid = '         '; // nine spaces representing empty grid
    const Symbols = [
        PlayerType::Host => 'X',
        PlayerType::Guest => 'O'
    ];

    private $id = null;
    private $hostID = null;
    private $guestID = null;
    private $grid = self::StartingGrid;
    private $status = GameStatus::Starting;
    private $currentPlayer = PlayerType::Host;
    private $turns = 0;
    private $winner = null;
    private $winType = WinType::None;
    private $winningLine = null;

    /**
     * @throws Exception
     */
    static function session_start()
    {
        if (session_status() == PHP_SESSION_NONE)
        {
            if (!session_start()) {
                http_response_code(500);
                throw new Exception('Could not start a session');
            }
        }

        if (!isset($_SESSION['id'])) {
            $_SESSION['id'] = bin2hex(openssl_random_pseudo_bytes(10));
        }
    }
    
    /**
     * @throws Exception
     */
    function save() : void {
        if (!file_exists(self::GamesFolder))
        {
            mkdir(self::GamesFolder);
        }
        $fh = fopen(self::GamesFolder . '/' . $this->id . '.json', 'w');
        if ($fh !== false) {
            if (fwrite($fh, json_encode($this)) !== false) {
                fclose($fh);
                return;
            }
        }

        fclose($fh);
        http_response_code(500);
        throw new Exception('Could not save the game data');
    }

    /**
     * @param int $row
     * @param int $col
     * @return int
     */
    private function checkWin(int $row, int $col) : int {
        $winningSymbol = self::Symbols[$this->currentPlayer];
        $win = true;

        $winningLine = [['row' => 0, 'col' => $col], ['row' => 2, 'col' => $col]];
        for ($i = 0; $i < 3; $i++) { // Vertical Check
            $pos = 3 * $i + $col;
            $char = $this->grid[$pos];
            if ($char !== $winningSymbol) {
                $win = false;
                break;
            }
        }
        if ($win) {
            $this->winningLine = $winningLine;
            return WinType::Win;
        }

        $win = true;
        $winningLine = [['row' => $row, 'col' => 0], ['row' => $row, 'col' => 2]];
        for ($i = 0; $i < 3; $i++) { // Horizontal Check
            $pos = 3 * $row + $i;
            $char = $this->grid[$pos];

            if ($char !== $winningSymbol) {
                $win = false;
                break;
            }
        }
        if ($win) {
            $this->winningLine = $winningLine;
            return WinType::Win;
        }

        if (($row == 0 && $col == 0) || ($row == 1 && $col == 1) || ($row == 2 && $col == 2) || ($row == 2 && $col == 0) || ($row == 0 && $col == 2)) { // Diagonal check only if we hit dead center or corners
            if ($this->grid[0] === $winningSymbol && $this->grid[4] === $winningSymbol && $this->grid[8] === $winningSymbol) {
                $this->winningLine = [['row' => 0, 'col' => 0], ['row' => 2, 'col' => 2]];
                return $this->winType = WinType::Win;
            }
            elseif ($this->grid[2] === $winningSymbol && $this->grid[4] === $winningSymbol && $this->grid[6] === $winningSymbol) {
                $this->winningLine = [['row' => 0, 'col' => 2], ['row' => 2, 'col' => 0]];
                return $this->winType = WinType::Win;
            }
        }

        if (strpos($this->grid, ' ') === false) {
            return $this->winType = WinType::Tie;
        }

        return $this->winType = WinType::None;
    }

    /**
     * @param int $row
     * @param int $col
     * @return array
     * @throws Exception
     */
    public function makeMove(int $row, int $col) : array {
        if ($this->status !== GameStatus::Started) {
            http_response_code(409);
            throw new Exception('The game is not in progress!');
        }

        self::session_start();
        $sessionID = $_SESSION['id'];

        if ($sessionID !== $this->hostID && $sessionID !== $this->guestID) {
            http_response_code(403);
            throw new Exception('This is not your game!');
        }

        if (($this->currentPlayer === PlayerType::Host && $sessionID !== $this->hostID) || ($this->currentPlayer === PlayerType::Guest && $sessionID !== $this->guestID)) {
            http_response_code(403);
            throw new Exception('This is not your turn!');
        }

        if ($row > 2 || $col > 2) {
            http_response_code(409);
            throw new Exception('Invalid cell');
        }

        $pos = 3 * $row + $col;

        if ($this->grid[$pos] !== ' ') {
            http_response_code(409);
            throw new Exception('This cell is full!');
        }
        else {
            http_response_code(200);

            $this->grid[$pos] = self::Symbols[$this->currentPlayer];
            $winType = $this->checkWin($row, $col);
            if ($winType === WinType::None)
            {
                $this->currentPlayer = ($this->currentPlayer === PlayerType::Host ? PlayerType::Guest : PlayerType::Host);
            }
            elseif ($winType === WinType::Tie) {
                $this->status = GameStatus::Ended;
                $this->winner = null;
            }
            else
            {
                $this->status = GameStatus::Ended;
                $this->winner = $this->currentPlayer;
            }

            $this->save();

            return $this->getGameStatus();
        }
    }

    /**
     * @param string $id
     * @return static
     * @throws Exception
     */
    public static function load(string $id) : ?self {
        $gamePath = self::GamesFolder . '/' . $id . '.json';

        if (!file_exists($gamePath)) {
            http_response_code(404);
            return null;
        }

        $fh = fopen($gamePath, 'r');
        if ($fh !== false) {
            $fileSize = @filesize($gamePath);

            if ($fileSize !== false && ($data = fread($fh, $fileSize)) !== false) {
                $game = new self();
                $data = json_decode($data, true);
                $game->id = $data['id'];
                $game->hostID = $data['hostID'];
                $game->guestID = $data['guestID'];
                $game->grid = $data['grid'];
                $game->status = $data['status'];
                $game->currentPlayer = $data['currentPlayer'];
                $game->turns = $data['turns'];
                $game->winner = $data['winner'];
                $game->winType = $data['winType'];
                $game->winningLine = $data['winningLine'];
                return $game;
            }
        }

        http_response_code(500);
        throw new Exception('Could not load the game data');
    }

    /**
     * @return array
     * @throws Exception
     */
    public static function create() : array {
        $game = new self();

        self::session_start();

        $game->hostID = $_SESSION['id'];
        $game->id = bin2hex(openssl_random_pseudo_bytes(10));
        $game->save();

        http_response_code(200);
        return $game->getGameStatus();
    }

    /**
     * @return array
     * @throws Exception
     */
    public function join() : array {
        if ($this->status === GameStatus::Starting) {
            self::session_start();
            $sessionID = $_SESSION['id'];

            if ($sessionID === $this->hostID) {
                http_response_code(403);
                throw new Exception("You cannot play against yourself!");
            }
            elseif ($this->guestID === null) {
                $this->guestID = $sessionID;
                $this->status = GameStatus::Started;
                $this->save();
            }
            elseif ($this->guestID !== $sessionID) {
                http_response_code(403);
                throw new Exception("This game is full!");
            }

            http_response_code(200);
            return $this->getGameStatus();
        }
        else {
            http_response_code(403);
            throw new Exception("Game has already started");
        }
    }

    /**
     * @return array
     * @throws Exception
     */
    public function getGameStatus() : array {
        http_response_code(200);
        $arr = $this->jsonSerialize();
        unset($arr['hostID']);
        unset($arr['guestID']);
        unset($arr['currentPlayer']);

        self::session_start();
        $sessionID = $_SESSION['id'];

        if ($this->currentPlayer === PlayerType::Host) {
            $arr['myTurn'] = $this->hostID === $sessionID;
        }
        else {
            $arr['myTurn'] = $this->guestID === $sessionID;
        }

        if ($this->winner === PlayerType::Host) {
            $arr['won'] = $this->hostID === $sessionID;
        }
        elseif ($this->winner === PlayerType::Guest) {
            $arr['won'] = $this->guestID === $sessionID;
        }
        else {
            $arr['won'] = false;
        }

        $arr['spectating'] = $this->hostID !== $sessionID && $this->guestID !== $sessionID;

        $arr['canJoin'] = $this->guestID === null && $this->hostID !== $sessionID;

        return $arr;
    }

    /**
     * @inheritDoc
     */
    public function jsonSerialize()
    {
        return [
            'id' => $this->id,
            'hostID' => $this->hostID,
            'guestID' => $this->guestID,
            'grid' => $this->grid,
            'status' => $this->status,
            'currentPlayer' => $this->currentPlayer,
            'turns' => $this->turns,
            'winner' => $this->winner,
            'winType' => $this->winType,
            'winningLine' => $this->winningLine
        ];
    }
}