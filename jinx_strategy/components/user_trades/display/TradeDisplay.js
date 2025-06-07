import React, { useState, useEffect } from 'react';
import { getUserTradesFromDB } from '../../../../services/indexedDBService.js';

const TradeDisplay = () => {
    const [trades, setTrades] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTrades = async () => {
            try {
                setIsLoading(true);
                const fetchedTrades = await getUserTradesFromDB();
                setTrades(fetchedTrades || []);
                setError(null);
            } catch (err) {
                console.error("Error fetching trades:", err);
                setError('Failed to load trades.');
                setTrades([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrades();
    }, []); // Empty dependency array to run once on mount

    if (isLoading) return <p>Loading trades...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

    return (
        <div>
            <h2>Trade Display</h2>
            {trades.length === 0 ? (
                <p>No trades to display.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Date</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Type</th>
                            <th>Notes</th> {/* Display notes */}
                        </tr>
                    </thead>
                    <tbody>
                        {trades.map(trade => (
                            <tr key={trade.id}>
                                <td>{trade.symbol}</td>
                                <td>{trade.date}</td>
                                <td>{trade.quantity}</td>
                                <td>{trade.price}</td>
                                <td>{trade.type}</td>
                                <td>{trade.notes || ''}</td> {/* Display notes */}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
export default TradeDisplay;
