import { market } from './Market.js';

$(document).ready(function(){
    $('#fetch-data-button').click(() => market.fetchMarketData());
    
    // Fetch data and update chart every 60 seconds
    market.fetchDataAndUpdateChart();
    setInterval(() => market.fetchDataAndUpdateChart(), 60000);
});
