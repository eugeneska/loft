<?php
/**
 * API endpoint for frontend pricing calculator
 * Returns data in format compatible with existing calculator
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($path, '/'));

// Check if this is the halls-pricing endpoint
$isHallsPricing = (end($segments) === 'halls-pricing' || 
                   (isset($segments[1]) && $segments[1] === 'halls-pricing'));

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $isHallsPricing) {
    try {
        // Get all active halls
        $halls = $db->fetchAll("
            SELECT id, code, name, capacity
            FROM halls
            WHERE is_active = 1
            ORDER BY sort_order, name
        ");
        
        // Get all price sets
        $priceSets = $db->fetchAll("SELECT id, code FROM price_sets");
        $priceSetMap = [];
        foreach ($priceSets as $ps) {
            $priceSetMap[$ps['id']] = $ps['code'];
        }
        
        // Get all hall prices
        $hallPrices = $db->fetchAll("
            SELECT hp.*, h.code as hall_code, ps.code as price_set_code
            FROM hall_prices hp
            JOIN halls h ON hp.hall_id = h.id
            JOIN price_sets ps ON hp.price_set_id = ps.id
        ");
        
        // Get all active extras
        $extras = $db->fetchAll("
            SELECT id, code, name, pricing_type
            FROM extras
            WHERE is_active = 1
            ORDER BY sort_order, name
        ");
        
        // Get all extra prices
        $extraPrices = $db->fetchAll("
            SELECT ep.*, e.code as extra_code, ps.code as price_set_code
            FROM extras_prices ep
            JOIN extras e ON ep.extra_id = e.id
            JOIN price_sets ps ON ep.price_set_id = ps.id
        ");
        
        // Get all season rules
        $seasonRules = $db->fetchAll("
            SELECT sr.*, ps.code as price_set_code
            FROM season_rules sr
            JOIN price_sets ps ON sr.price_set_id = ps.id
            ORDER BY sr.priority DESC
        ");
        
        // Build response structure
        $response = [
            'halls' => [],
            'extras' => [],
            'seasonRules' => []
        ];
        
        // Process halls
        foreach ($halls as $hall) {
            $hallCode = $hall['code'];
            $prices = [];
            
            // Group prices by price set code
            foreach ($hallPrices as $hp) {
                if ($hp['hall_code'] === $hallCode) {
                    $priceSetCode = $hp['price_set_code'];
                    $weekdayPrice = $hp['weekday_10_22'] ?? $hp['weekday_price'] ?? 0;
                    
                    $prices[$priceSetCode] = [
                        'weekday' => (float)$weekdayPrice,
                        'weekday_10_22' => (float)($hp['weekday_10_22'] ?? $hp['weekday_price'] ?? 0),
                        'weekday_22_00' => (float)($hp['weekday_22_00'] ?? $hp['weekday_price'] ?? 0),
                        'friSat' => (float)$hp['fri_sat_price'],
                        'sun' => (float)$hp['sun_price'],
                        'cleaningUpTo30' => (float)$hp['cleaning_up_to_30'],
                        'cleaningOver30' => (float)$hp['cleaning_over_30'],
                        'afterHoursFee' => (float)$hp['after_hours_fee'],
                        'minHours' => (int)$hp['min_hours'],
                        'minHoursSaturday' => (int)($hp['min_hours_saturday'] ?? $hp['min_hours']),
                        'foodAlcoholFromHours' => (int)$hp['allow_food_alcohol_from_hours']
                    ];
                }
            }
            
            $response['halls'][] = [
                'code' => $hall['code'],
                'name' => $hall['name'],
                'capacity' => (int)$hall['capacity'],
                'prices' => $prices
            ];
        }
        
        // Process extras
        foreach ($extras as $extra) {
            $extraCode = $extra['code'];
            $priceSetsForExtra = [];
            
            // Group prices by price set code
            foreach ($extraPrices as $ep) {
                if ($ep['extra_code'] === $extraCode) {
                    $priceSetCode = $ep['price_set_code'];
                    $priceSetsForExtra[$priceSetCode] = [];
                    
                    if ($ep['base_price'] !== null) {
                        $priceSetsForExtra[$priceSetCode]['basePrice'] = (float)$ep['base_price'];
                    }
                    if ($ep['additional_unit_price'] !== null) {
                        $priceSetsForExtra[$priceSetCode]['additionalUnitPrice'] = (float)$ep['additional_unit_price'];
                    }
                    if ($ep['unit_description']) {
                        $priceSetsForExtra[$priceSetCode]['unitDescription'] = $ep['unit_description'];
                    }
                }
            }
            
            $response['extras'][$extraCode] = [
                'name' => $extra['name'],
                'pricingType' => $extra['pricing_type'],
                'priceSets' => $priceSetsForExtra
            ];
        }
        
        // Process season rules
        foreach ($seasonRules as $rule) {
            // Parse days of week mask
            $daysOfWeek = array_filter(
                array_map('intval', explode(',', $rule['days_of_week_mask'])),
                function($d) { return !is_nan($d); }
            );
            
            $response['seasonRules'][] = [
                'priceSetCode' => $rule['price_set_code'],
                'startDate' => $rule['start_date'],
                'endDate' => $rule['end_date'],
                'daysOfWeek' => array_values($daysOfWeek),
                'priority' => (int)$rule['priority']
            ];
        }
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Error fetching pricing data: ' . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch pricing data']);
    }
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

