(function() {
    'use strict';

    const DB_NAME = 'CompanyGroupsDB';
    const STORE_NAME = 'companies';
    const DB_VERSION = 1;

    // --- IndexedDB Helper Functions ---
    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'company_id' });
                }
            };
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event.target.error);
        });
    }

    function cacheCompanies(db, companies) {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        companies.forEach(company => store.put(company));
        return transaction.complete;
    }

    function getCachedCompanies(db) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Hash Function for Data Integrity ---
    async function generateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // --- Role Badge Colors ---
    function getRoleBadgeClass(role) {
        const roleClasses = {
            'professor': 'badge-primary',
            'leader': 'badge-success',
            'assistant': 'badge-info',
            'guest_speaker': 'badge-warning'
        };
        return roleClasses[role] || 'badge-secondary';
    }

    // --- Display Functions ---
    function displayCompanies(companies) {
        const grid = document.getElementById('company-grid');
        grid.innerHTML = '';
        
        if (!companies || companies.length === 0) {
            grid.innerHTML = '<div class="col-12"><p class="text-center">No companies available.</p></div>';
            return;
        }
        
        companies.forEach(company => {
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            
            const features = [];
            if (company.has_lottery) features.push('<span class="badge badge-success">Lottery</span>');
            if (company.has_raffle) features.push('<span class="badge badge-info">Raffle</span>');
            if (company.has_monthly_disbursement) features.push('<span class="badge badge-warning">Monthly Disbursement</span>');
            
            card.innerHTML = `
                <div class="card company-card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">${company.name}</h5>
                    </div>
                    <div class="card-body">
                        <p class="card-text">${company.description || 'No description'}</p>
                        <p><strong>Members:</strong> ${company.members?.length || 0}</p>
                        <p><strong>Schedules:</strong> ${company.schedules?.length || 0}</p>
                        <p><strong>Incentives:</strong> ${company.incentive_tasks?.length || 0}</p>
                        <div class="features mb-2">${features.join(' ')}</div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-primary btn-sm view-details" data-company-id="${company.company_id}">
                            View Details
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        // Add click handlers
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', () => {
                const companyId = btn.dataset.companyId;
                showCompanyDetails(companyId);
            });
        });
    }

    async function showCompanyDetails(companyId) {
        try {
            const response = await fetch(`/api/companies/${companyId}`);
            if (!response.ok) throw new Error('Failed to fetch company details');
            const company = await response.json();

            // Update modal title
            document.getElementById('companyModalLabel').textContent = company.name;

            // Display members
            displayMembers(company.members || []);

            // Display schedules
            displaySchedules(company.schedules || []);

            // Display incentives
            displayIncentives(company.incentive_tasks || []);

            // Display stocks
            displayStocks(company.stock_recommendations || []);

            // Display events
            displayEvents(company);

            // Show modal
            $('#companyModal').modal('show');
        } catch (error) {
            console.error('Error loading company details:', error);
            alert('Failed to load company details');
        }
    }

    function displayMembers(members) {
        const container = document.getElementById('members-content');
        if (members.length === 0) {
            container.innerHTML = '<p>No members yet.</p>';
            return;
        }

        const html = members.map(m => `
            <div class="member-item p-2 border-bottom">
                <strong>${m.name}</strong>
                <span class="badge ${getRoleBadgeClass(m.role)} ml-2">${m.role}</span>
                <small class="text-muted d-block">${m.email}</small>
            </div>
        `).join('');
        container.innerHTML = html;
    }

    function displaySchedules(schedules) {
        const container = document.getElementById('schedules-content');
        if (schedules.length === 0) {
            container.innerHTML = '<p>No schedules yet.</p>';
            return;
        }

        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const html = schedules.map(s => `
            <div class="schedule-item p-2 border-bottom">
                <strong>${s.name}</strong>
                ${s.is_active ? '<span class="badge badge-success ml-2">Active</span>' : '<span class="badge badge-secondary ml-2">Inactive</span>'}
                ${s.include_weekends ? '<span class="badge badge-warning ml-2">Weekends</span>' : ''}
                <div class="mt-1">
                    <small><strong>Days:</strong> ${s.days.map(d => dayNames[d]).join(', ')}</small>
                </div>
                <div>
                    <small><strong>Time:</strong> ${s.start_time} - ${s.end_time}</small>
                </div>
            </div>
        `).join('');
        container.innerHTML = html;
    }

    function displayIncentives(incentives) {
        const container = document.getElementById('incentives-content');
        if (incentives.length === 0) {
            container.innerHTML = '<p>No incentive tasks yet.</p>';
            return;
        }

        const html = incentives.map(i => `
            <div class="incentive-item p-2 border-bottom">
                <strong>${i.name}</strong>
                <span class="badge badge-primary ml-2">${i.task_type}</span>
                <span class="badge badge-success ml-2">$${i.reward_amount}</span>
                <span class="badge badge-info ml-2">${i.frequency}</span>
                <p class="mb-1 mt-1"><small>${i.description}</small></p>
                ${i.links && i.links.length > 0 ? `
                    <div class="links">
                        ${i.links.map((l, idx) => `<a href="${l}" class="btn btn-sm btn-outline-primary mr-1" target="_blank">Link ${idx + 1}</a>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
        container.innerHTML = html;
    }

    function displayStocks(stocks) {
        const container = document.getElementById('stocks-content');
        if (stocks.length === 0) {
            container.innerHTML = '<p>No stock recommendations yet.</p>';
            return;
        }

        const html = stocks.map(s => `
            <div class="stock-item p-2 border-bottom">
                <strong>${s.ticker}</strong> - ${s.company_name}
                <span class="badge badge-${s.recommendation_type === 'buy' ? 'success' : s.recommendation_type === 'sell' ? 'danger' : 'warning'} ml-2">
                    ${s.recommendation_type.toUpperCase()}
                </span>
                ${s.incentive_reward > 0 ? `<span class="badge badge-success ml-2">Incentive: $${s.incentive_reward}</span>` : ''}
                ${s.purchase_link ? `<a href="${s.purchase_link}" class="btn btn-sm btn-outline-success ml-2" target="_blank">Purchase</a>` : ''}
            </div>
        `).join('');
        container.innerHTML = html;
    }

    function displayEvents(company) {
        const container = document.getElementById('events-content');
        let html = '';

        // Lotteries
        if (company.lotteries && company.lotteries.length > 0) {
            html += '<h6>Lotteries</h6>';
            html += company.lotteries.map(l => `
                <div class="event-item p-2 border-bottom">
                    <strong>${l.name}</strong>
                    <span class="badge badge-primary ml-2">Prize: $${l.prize_amount}</span>
                    <small class="d-block">Draw Date: ${l.draw_date}</small>
                </div>
            `).join('');
        }

        // Raffles
        if (company.raffles && company.raffles.length > 0) {
            html += '<h6 class="mt-3">Raffles</h6>';
            html += company.raffles.map(r => `
                <div class="event-item p-2 border-bottom">
                    <strong>${r.name}</strong>
                    <span class="badge badge-info ml-2">Prize: $${r.prize_amount}</span>
                    <small class="d-block">Draw Date: ${r.draw_date}</small>
                </div>
            `).join('');
        }

        // Disbursements
        if (company.disbursements && company.disbursements.length > 0) {
            html += '<h6 class="mt-3">Monthly Disbursements</h6>';
            html += company.disbursements.map(d => `
                <div class="event-item p-2 border-bottom">
                    <strong>${d.name}</strong>
                    <span class="badge badge-warning ml-2">Amount: $${d.amount}</span>
                    <small class="d-block">Next Date: ${d.next_date}</small>
                </div>
            `).join('');
        }

        if (!html) {
            html = '<p>No events configured.</p>';
        }

        container.innerHTML = html;
    }

    // --- Form Handling ---
    async function createCompany(formData) {
        try {
            const response = await fetch('/api/companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create company');
            }

            const company = await response.json();
            console.log('Company created:', company);
            
            // Refresh the companies list
            await loadCompanies();
            return company;
        } catch (error) {
            console.error('Error creating company:', error);
            throw error;
        }
    }

    // --- Main Application Logic ---
    async function loadCompanies() {
        let db;
        try {
            db = await openDb();
            const cachedData = await getCachedCompanies(db);
            if (cachedData.length > 0) {
                console.log("Displaying data from cache.");
                displayCompanies(cachedData);
            }
        } catch (err) {
            console.error("IndexedDB error:", err);
        }

        try {
            console.log("Fetching fresh data...");
            const response = await fetch('/api/companies');
            if (!response.ok) throw new Error('Network response failed');
            const companies = await response.json();

            // Generate hash for data integrity
            const dataHash = await generateHash(companies);
            console.log('Data hash:', dataHash);

            console.log("Displaying fresh data and updating cache.");
            displayCompanies(companies);

            if (db) {
                await cacheCompanies(db, companies);
                console.log("Cache updated.");
            }
        } catch (error) {
            console.error('Failed to fetch companies:', error);
            const grid = document.getElementById('company-grid');
            if (!grid.hasChildNodes()) {
                grid.innerHTML = '<div class="col-12"><p class="text-danger">Error loading companies. Please try again later.</p></div>';
            }
        }
    }

    async function main() {
        // Load companies
        await loadCompanies();

        // Setup form submission
        const form = document.getElementById('create-company-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('companyName').value,
                description: document.getElementById('companyDesc').value,
                has_lottery: document.getElementById('hasLottery').checked,
                has_raffle: document.getElementById('hasRaffle').checked,
                has_monthly_disbursement: document.getElementById('hasDisbursement').checked
            };

            try {
                await createCompany(formData);
                form.reset();
                alert('Company created successfully!');
            } catch (error) {
                alert('Failed to create company: ' + error.message);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', main);

})();
