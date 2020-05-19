<?php

foreach (glob("enums/*.php") as $filename) // Here we require the files needed for the project
{
    require $filename;
}

foreach (glob("classes/*.php") as $filename) // Here we require the files needed for the project
{
    require $filename;
}

$routes = []; // Empty route array
foreach (glob("routes/*.php") as $filename) // Here we require the files needed for the project
{
    require $filename; // This require will fill the array up
}

$requestedRoute = str_replace('api/', '', ltrim($_SERVER["REQUEST_URI"], '/')); // We want the requested route URL to start after 'api/' and ignore anything else
if ($queryStringPos = strpos($requestedRoute, '?')) { // We remove the querystring
    $requestedRoute = substr($requestedRoute, 0, $queryStringPos);
}

foreach ($routes as $route) {
    $matches = [];
    if (strtolower($route['method']) === strtolower($_SERVER['REQUEST_METHOD']) && preg_match('/^' . $route['url'] . '$/', $requestedRoute, $matches)) { // We check that the requested route and method match a stored valid route and method
        $args = [];
        $matchCount = count($matches); // We get the regex matches count
        for ($i = 1; $i < $matchCount; $i++) { // Starting from the second match onward, the first match is useless to us
            $argNames = $route['argNames']; // I we set argnames
            if ($argNames !== null) {
                $args[$argNames[$i - 1]] = $matches[$i]; // We store the args with the names specified
            }
            else
            {
                $args[] = $matches[$i]; // Otherwise we store them by numerical index as usual
            }
        }

        try {
            if (strtolower($route['method']) !== 'get') {
                $body = file_get_contents('php://input');
                if (($_SERVER['CONTENT_TYPE'] ?? null) === 'application/json') {
                    $payload = json_decode($body, true);
                    if ($payload === null && $body !== 'null') {
                        http_response_code(400);
                        throw new Exception('Invalid request!');
                    }
                    elseif (!isset($payload['payload'])) {
                        http_response_code(400);
                        throw new Exception('Payload is missing!');
                    }
                    $payload = $payload['payload'];
                }
                else
                {
                    $payload = $body;
                }
            }

            $response = ['payload' => $route['callback']($args, $payload ?? null)];
        }
        catch (Exception $e) {
            $response = ['error' => $e->getMessage()];
        }

        header('Content-Type: application/json');
        die(json_encode($response));
    }
}