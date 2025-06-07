import React from 'react';
import Calendar from './calendar/Calendar';
import TradeForm from './form/TradeForm';
import TradeDisplay from './display/TradeDisplay';

const UserTradesPage = () => {
    return (
        <div>
            <h1>User Trades</h1>
            <p>Keep track of your trades here.</p>

            {/* Integrate other components here */}
            <Calendar />
            <hr />
            <TradeForm />
            <hr />
            <TradeDisplay />
        </div>
    );
};

export default UserTradesPage;
