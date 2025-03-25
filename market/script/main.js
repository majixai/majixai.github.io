import { market } from './Market.js';

$(document).ready(function(){
    // Fetch data and update chart every 60 seconds
    market.fetchDataAndUpdateChart();
    setInterval(() => market.fetchDataAndUpdateChart(), 60000);
});
