/**
 * API endpoint for frontend pricing calculator
 * Returns data in format compatible with existing calculator
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/pricing/halls-pricing
 * Get all pricing data for frontend calculator
 */
router.get('/halls-pricing', (req, res) => {
    try {
        const db = getDatabase();
        
        // Get all active halls
        const halls = db.prepare(`
            SELECT id, code, name, capacity
            FROM halls
            WHERE is_active = 1
            ORDER BY sort_order, name
        `).all();
        
        // Get all price sets
        const priceSets = db.prepare('SELECT id, code FROM price_sets').all();
        const priceSetMap = {};
        priceSets.forEach(ps => {
            priceSetMap[ps.id] = ps.code;
        });
        
        // Get all hall prices
        const hallPrices = db.prepare(`
            SELECT hp.*, h.code as hall_code, ps.code as price_set_code
            FROM hall_prices hp
            JOIN halls h ON hp.hall_id = h.id
            JOIN price_sets ps ON hp.price_set_id = ps.id
        `).all();
        
        // Get all active extras
        const extras = db.prepare(`
            SELECT id, code, name, pricing_type
            FROM extras
            WHERE is_active = 1
            ORDER BY sort_order, name
        `).all();
        
        // Get all extra prices
        const extraPrices = db.prepare(`
            SELECT ep.*, e.code as extra_code, ps.code as price_set_code
            FROM extras_prices ep
            JOIN extras e ON ep.extra_id = e.id
            JOIN price_sets ps ON ep.price_set_id = ps.id
        `).all();
        
        // Get all season rules
        const seasonRules = db.prepare(`
            SELECT sr.*, ps.code as price_set_code
            FROM season_rules sr
            JOIN price_sets ps ON sr.price_set_id = ps.id
            ORDER BY sr.priority DESC
        `).all();
        
        // Build response structure
        const response = {
            halls: halls.map(hall => {
                const hallCode = hall.code;
                const prices = {};
                
                // Group prices by price set code
                hallPrices
                    .filter(hp => hp.hall_code === hallCode)
                    .forEach(hp => {
                        const priceSetCode = hp.price_set_code;
                        prices[priceSetCode] = {
                            weekday: parseFloat(hp.weekday_10_22 || hp.weekday_price || 0),
                            weekday_10_22: parseFloat(hp.weekday_10_22 || hp.weekday_price || 0),
                            weekday_22_00: parseFloat(hp.weekday_22_00 || hp.weekday_price || 0),
                            friSat: parseFloat(hp.fri_sat_price),
                            sun: parseFloat(hp.sun_price),
                            cleaningUpTo30: parseFloat(hp.cleaning_up_to_30),
                            cleaningOver30: parseFloat(hp.cleaning_over_30),
                            afterHoursFee: parseFloat(hp.after_hours_fee),
                            minHours: hp.min_hours,
                            minHoursSaturday: hp.min_hours_saturday || hp.min_hours,
                            foodAlcoholFromHours: hp.allow_food_alcohol_from_hours
                        };
                    });
                
                return {
                    code: hall.code,
                    name: hall.name,
                    capacity: hall.capacity,
                    prices: prices
                };
            }),
            extras: {},
            seasonRules: seasonRules.map(rule => {
                // Parse days of week mask
                const daysOfWeek = rule.days_of_week_mask
                    .split(',')
                    .map(d => parseInt(d.trim()))
                    .filter(d => !isNaN(d));
                
                return {
                    priceSetCode: rule.price_set_code,
                    startDate: rule.start_date,
                    endDate: rule.end_date,
                    daysOfWeek: daysOfWeek,
                    priority: rule.priority
                };
            })
        };
        
        // Build extras structure
        extras.forEach(extra => {
            const extraCode = extra.code;
            const priceSetsForExtra = {};
            
            // Group prices by price set code
            extraPrices
                .filter(ep => ep.extra_code === extraCode)
                .forEach(ep => {
                    const priceSetCode = ep.price_set_code;
                    priceSetsForExtra[priceSetCode] = {};
                    
                    if (ep.base_price !== null) {
                        priceSetsForExtra[priceSetCode].basePrice = parseFloat(ep.base_price);
                    }
                    if (ep.additional_unit_price !== null) {
                        priceSetsForExtra[priceSetCode].additionalUnitPrice = parseFloat(ep.additional_unit_price);
                    }
                    if (ep.unit_description) {
                        priceSetsForExtra[priceSetCode].unitDescription = ep.unit_description;
                    }
                });
            
            response.extras[extraCode] = {
                name: extra.name,
                pricingType: extra.pricing_type,
                priceSets: priceSetsForExtra
            };
        });
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching pricing data:', error);
        res.status(500).json({ error: 'Failed to fetch pricing data' });
    }
});

module.exports = router;

