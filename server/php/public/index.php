<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Names\Api;
use Names\NameStore;

$store = new NameStore(getenv('NAMES_STORE') ?: sys_get_temp_dir() . '/jsctrls-names.json');
$delay = getenv('DEMO_DELAY_MS');

Api::create($store, $delay === false || $delay === '' ? 300 : (int) $delay)->run();
