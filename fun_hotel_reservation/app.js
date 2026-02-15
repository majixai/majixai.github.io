const hotels = [
  { id: 1, name: 'Sunburst Miami Bay', location: 'Miami', price: 259, amenities: ['wifi', 'pool', 'breakfast', 'gym'], rooms: 6 },
  { id: 2, name: 'Neon Tokyo Gardens', location: 'Tokyo', price: 330, amenities: ['wifi', 'spa', 'gym'], rooms: 4 },
  { id: 3, name: 'Paris Glow Palace', location: 'Paris', price: 410, amenities: ['wifi', 'spa', 'breakfast', 'parking'], rooms: 5 },
  { id: 4, name: 'Ocean Pop Cancun', location: 'Cancun', price: 220, amenities: ['wifi', 'pool', 'breakfast'], rooms: 9 },
  { id: 5, name: 'Citrus Sky Barcelona', location: 'Barcelona', price: 285, amenities: ['wifi', 'parking', 'gym'], rooms: 7 },
  { id: 6, name: 'Aurora Palm Dubai', location: 'Dubai', price: 499, amenities: ['wifi', 'pool', 'spa', 'parking', 'gym'], rooms: 3 }
];

const countries = {
  us: { center: { lat: 37.1, lng: -95.7 }, zoom: 3 },
  ca: { center: { lat: 56.1, lng: -106.3 }, zoom: 3 },
  mx: { center: { lat: 23.6, lng: -102.5 }, zoom: 4 },
  uk: { center: { lat: 54.8, lng: -4.6 }, zoom: 5 },
  fr: { center: { lat: 46.2, lng: 2.2 }, zoom: 5 },
  de: { center: { lat: 51.2, lng: 10.4 }, zoom: 5 },
  es: { center: { lat: 40.5, lng: -3.7 }, zoom: 5 },
  it: { center: { lat: 41.9, lng: 12.6 }, zoom: 5 },
  pt: { center: { lat: 39.4, lng: -8.2 }, zoom: 6 },
  au: { center: { lat: -25.3, lng: 133.8 }, zoom: 4 },
  br: { center: { lat: -14.2, lng: -51.9 }, zoom: 3 },
  za: { center: { lat: -30.6, lng: 22.9 }, zoom: 5 },
  all: { center: { lat: 15, lng: 0 }, zoom: 2 }
};

const state = {
  account: JSON.parse(localStorage.getItem('funstay_account') || 'null'),
  visitLog: JSON.parse(localStorage.getItem('funstay_visit_log') || '[]'),
  booking: JSON.parse(localStorage.getItem('funstay_booking') || 'null'),
  actionLog: JSON.parse(localStorage.getItem('funstay_action_log') || '[]'),
  activeResults: [...hotels],
  activeHotelsIndex: Object.fromEntries(hotels.map(h => [String(h.id), h])),
  googleIdentityReady: false,
  googlePlacesReady: false,
  autocompleteRequestToken: 0,
  placesService: null,
  map: null,
  mapMarkers: [],
  infoWindow: null,
  cityAutocomplete: null,
  selectedCountry: 'us',
  selectedPlace: null,
  gps: {
    permission: 'prompt',
    lastKnown: null,
    lastRequestedAt: null,
    lastError: null
  }
};

// ============================================
// ActionTracker - Extensive User Event Tracking
// ============================================
const ActionTracker = {
  categories: {
    AUTH: 'authentication',
    SEARCH: 'search',
    BOOKING: 'booking',
    CALENDAR: 'calendar',
    WALLET: 'wallet',
    NETWORK: 'network',
    GPS: 'location',
    UI: 'user_interface',
    SYSTEM: 'system'
  },
  
  severities: {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ACTION: 'action',
    CRITICAL: 'critical'
  },

  maxActions: 1000,

  track(category, action, details = {}, severity = 'info') {
    const entry = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      category,
      action,
      severity,
      details: {
        ...details,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        url: window.location.href
      },
      sessionId: this.getSessionId()
    };

    state.actionLog.push(entry);
    if (state.actionLog.length > this.maxActions) {
      state.actionLog = state.actionLog.slice(-this.maxActions);
    }

    this.persistActions();
    this.notifyActionListeners(entry);
    appLog.push(severity, `[${category}] ${action}`, details);
    return entry;
  },

  getSessionId() {
    let sessionId = sessionStorage.getItem('funstay_session_id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('funstay_session_id', sessionId);
    }
    return sessionId;
  },

  persistActions() {
    localStorage.setItem('funstay_action_log', JSON.stringify(state.actionLog));
  },

  listeners: [],

  addListener(callback) {
    this.listeners.push(callback);
  },

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  },

  notifyActionListeners(entry) {
    this.listeners.forEach(cb => {
      try {
        cb(entry);
      } catch (e) {
        console.error('ActionTracker listener error:', e);
      }
    });
  },

  getActionsByCategory(category) {
    return state.actionLog.filter(a => a.category === category);
  },

  getActionsBySeverity(severity) {
    return state.actionLog.filter(a => a.severity === severity);
  },

  getRecentActions(count = 50) {
    return state.actionLog.slice(-count);
  },

  getActionsSince(timestamp) {
    return state.actionLog.filter(a => new Date(a.timestamp) >= new Date(timestamp));
  },

  getActionSummary() {
    const summary = {};
    Object.values(this.categories).forEach(cat => {
      summary[cat] = state.actionLog.filter(a => a.category === cat).length;
    });
    return summary;
  },

  clearOldActions(daysOld = 30) {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    state.actionLog = state.actionLog.filter(a => new Date(a.timestamp).getTime() > cutoff);
    this.persistActions();
  },

  // Convenience methods for common actions
  trackAuth(action, details) {
    return this.track(this.categories.AUTH, action, details, this.severities.ACTION);
  },

  trackSearch(action, details) {
    return this.track(this.categories.SEARCH, action, details, this.severities.INFO);
  },

  trackBooking(action, details) {
    return this.track(this.categories.BOOKING, action, details, this.severities.SUCCESS);
  },

  trackCalendar(action, details) {
    return this.track(this.categories.CALENDAR, action, details, this.severities.ACTION);
  },

  trackWallet(action, details) {
    return this.track(this.categories.WALLET, action, details, this.severities.ACTION);
  },

  trackNetwork(action, details) {
    return this.track(this.categories.NETWORK, action, details, this.severities.INFO);
  },

  trackGPS(action, details) {
    return this.track(this.categories.GPS, action, details, this.severities.INFO);
  },

  trackUI(action, details) {
    return this.track(this.categories.UI, action, details, this.severities.INFO);
  },

  trackSystem(action, details) {
    return this.track(this.categories.SYSTEM, action, details, this.severities.INFO);
  }
};

// ============================================
// ActionAlertEmailGenerator - Extensive Logistics Email
// ============================================
const ActionAlertEmailGenerator = {
  generateBookingConfirmationEmail(booking, actionHistory = []) {
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const formatDate = (d) => `${dayOfWeek[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    const formatTime = (hour) => `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

    const recentActions = actionHistory.slice(-20).map(a => ({
      time: new Date(a.timestamp).toLocaleString(),
      action: a.action,
      category: a.category
    }));

    return {
      subject: `🏨 Booking Confirmed: ${booking.hotel.name} | Ref: ${booking.bookingRef}`,
      
      to: booking.guest.email || 'guest@funstay.local',
      
      headers: {
        'X-FunStay-Booking-Ref': booking.bookingRef,
        'X-FunStay-Hotel-Id': String(booking.hotel.id),
        'X-FunStay-Priority': 'high',
        'X-FunStay-Action-Alert': 'booking-confirmation'
      },

      htmlBody: this.buildHtmlEmail(booking, checkInDate, checkOutDate, formatDate, formatTime, recentActions),
      
      textBody: this.buildTextEmail(booking, checkInDate, checkOutDate, formatDate, formatTime, recentActions),

      logistics: {
        booking: {
          reference: booking.bookingRef,
          status: 'CONFIRMED',
          createdAt: booking.createdAt,
          confirmationSentAt: new Date().toISOString()
        },
        
        guest: {
          name: booking.guest.name,
          email: booking.guest.email,
          type: booking.guest.type,
          guestCount: booking.guests
        },

        hotel: {
          id: booking.hotel.id,
          name: booking.hotel.name,
          location: booking.hotel.location,
          amenities: booking.hotel.amenities,
          pricePerNight: booking.hotel.price,
          rating: booking.hotel.rating || 'N/A',
          website: booking.hotel.website || 'N/A',
          phone: booking.hotel.phone || 'N/A'
        },

        stay: {
          checkIn: {
            date: booking.checkIn,
            formatted: formatDate(checkInDate),
            time: '3:00 PM',
            dayOfWeek: dayOfWeek[checkInDate.getDay()]
          },
          checkOut: {
            date: booking.checkOut,
            formatted: formatDate(checkOutDate),
            time: '11:00 AM',
            dayOfWeek: dayOfWeek[checkOutDate.getDay()]
          },
          nights: booking.nights,
          roomType: 'Standard Room'
        },

        pricing: {
          subtotal: booking.subtotal,
          discountPercent: booking.discountPct,
          discountAmount: booking.subtotal - booking.total,
          total: booking.total,
          currency: 'USD',
          paymentStatus: 'PENDING',
          taxesIncluded: false,
          estimatedTaxes: booking.total * 0.12
        },

        location: booking.guestLocation ? {
          latitude: booking.guestLocation.lat,
          longitude: booking.guestLocation.lng,
          accuracy: booking.guestLocation.accuracy,
          capturedAt: booking.guestLocation.timestamp ? new Date(booking.guestLocation.timestamp).toISOString() : null
        } : null,

        travelLogistics: {
          estimatedArrivalWindow: '2:00 PM - 6:00 PM',
          earlyCheckInAvailable: true,
          lateCheckOutAvailable: true,
          luggageStorage: true,
          airportShuttle: booking.hotel.amenities?.includes('parking') || false,
          parkingAvailable: booking.hotel.amenities?.includes('parking') || false,
          parkingType: 'Valet & Self-parking',
          parkingCost: '$25/day'
        },

        hotelServices: {
          wifi: {
            available: booking.hotel.amenities?.includes('wifi') || false,
            complimentary: true,
            networkName: 'FunStay-Guest',
            password: 'Available at front desk'
          },
          breakfast: {
            available: booking.hotel.amenities?.includes('breakfast') || false,
            included: booking.hotel.amenities?.includes('breakfast') || false,
            hours: '6:30 AM - 10:30 AM',
            location: 'Main Restaurant, Level 1'
          },
          pool: {
            available: booking.hotel.amenities?.includes('pool') || false,
            hours: '6:00 AM - 10:00 PM',
            towelsProvided: true
          },
          spa: {
            available: booking.hotel.amenities?.includes('spa') || false,
            reservationRequired: true,
            hours: '9:00 AM - 9:00 PM'
          },
          gym: {
            available: booking.hotel.amenities?.includes('gym') || false,
            hours: '24 hours',
            equipment: 'Full fitness center'
          }
        },

        policies: {
          cancellation: 'Free cancellation up to 24 hours before check-in',
          payment: 'Pay at property',
          idRequired: 'Government-issued photo ID required at check-in',
          creditCard: 'Credit card required for incidentals',
          pets: 'Pet-friendly rooms available upon request',
          smoking: 'Non-smoking property'
        },

        emergencyContacts: {
          hotelFrontDesk: '+1 (555) 123-4567',
          concierge: '+1 (555) 123-4568',
          funstaySupport: '+1 (800) FUNSTAY',
          emergencyServices: '911'
        },

        localInfo: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          weatherTip: 'Check local weather before your trip',
          localAttractions: [
            { name: 'City Center', distance: '2.5 miles' },
            { name: 'Beach', distance: '5 miles' },
            { name: 'Shopping District', distance: '1.2 miles' },
            { name: 'Airport', distance: '15 miles' }
          ],
          transportation: [
            { type: 'Taxi', availability: '24/7' },
            { type: 'Uber/Lyft', availability: 'Available in area' },
            { type: 'Public Transit', availability: 'Bus stop 0.3 miles' }
          ]
        },

        actionHistory: recentActions,

        alerts: this.generateAlerts(booking, checkInDate)
      }
    };
  },

  generateAlerts(booking, checkInDate) {
    const alerts = [];
    const now = new Date();
    const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilCheckIn <= 1) {
      alerts.push({
        type: 'urgent',
        icon: '🚨',
        message: 'Check-in is tomorrow or today! Make sure you have your ID ready.',
        priority: 'high'
      });
    } else if (daysUntilCheckIn <= 3) {
      alerts.push({
        type: 'reminder',
        icon: '📅',
        message: `Check-in in ${daysUntilCheckIn} days. Start preparing for your trip!`,
        priority: 'medium'
      });
    }

    if (!booking.guest.email) {
      alerts.push({
        type: 'warning',
        icon: '⚠️',
        message: 'No email on file. Add your email to receive updates.',
        priority: 'high'
      });
    }

    if (booking.hotel.amenities?.includes('breakfast')) {
      alerts.push({
        type: 'info',
        icon: '🍳',
        message: 'Complimentary breakfast included! Available 6:30 AM - 10:30 AM.',
        priority: 'low'
      });
    }

    if (booking.hotel.amenities?.includes('spa')) {
      alerts.push({
        type: 'tip',
        icon: '💆',
        message: 'Spa services available. Book in advance for best availability.',
        priority: 'low'
      });
    }

    alerts.push({
      type: 'action',
      icon: '📱',
      message: 'Download the FunStay app for mobile check-in and room key.',
      priority: 'medium'
    });

    alerts.push({
      type: 'action',
      icon: '📆',
      message: 'Add this booking to your calendar to get reminders.',
      priority: 'medium'
    });

    return alerts;
  },

  buildHtmlEmail(booking, checkInDate, checkOutDate, formatDate, formatTime, recentActions) {
    const amenityIcons = {
      wifi: '📶',
      pool: '🏊',
      spa: '💆',
      breakfast: '🍳',
      parking: '🅿️',
      gym: '🏋️'
    };

    const amenitiesHtml = booking.hotel.amenities.map(a => 
      `<span style="background:#e8f5e9;padding:4px 12px;border-radius:16px;margin:2px;display:inline-block;">
        ${amenityIcons[a] || '✓'} ${a.charAt(0).toUpperCase() + a.slice(1)}
      </span>`
    ).join('');

    const actionsHtml = recentActions.length > 0 ? 
      recentActions.slice(-10).map(a => 
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;">${a.time}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;">${a.category}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;">${a.action}</td>
        </tr>`
      ).join('') : '<tr><td colspan="3" style="padding:8px;text-align:center;">No recent actions</td></tr>';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - ${booking.bookingRef}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;">
  <div style="max-width:650px;margin:0 auto;background:#fff;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6b4eff,#ff4fa3);padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">🌈 FunStay</h1>
      <p style="color:#fff;margin:10px 0 0;opacity:0.9;">Your Booking is Confirmed!</p>
    </div>

    <!-- Alert Banner -->
    <div style="background:#4caf50;color:#fff;padding:15px;text-align:center;">
      <strong>✅ BOOKING CONFIRMED</strong> | Reference: <strong>${booking.bookingRef}</strong>
    </div>

    <!-- Main Content -->
    <div style="padding:30px;">
      <!-- Guest Info -->
      <div style="background:#f8f9ff;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">👤 Guest Information</h2>
        <p style="margin:5px 0;"><strong>Name:</strong> ${booking.guest.name}</p>
        <p style="margin:5px 0;"><strong>Email:</strong> ${booking.guest.email || 'Not provided'}</p>
        <p style="margin:5px 0;"><strong>Guest Count:</strong> ${booking.guests}</p>
        <p style="margin:5px 0;"><strong>Account Type:</strong> ${booking.guest.type}</p>
      </div>

      <!-- Hotel Info -->
      <div style="background:#fff3e0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">🏨 Hotel Details</h2>
        <h3 style="margin:0;color:#6b4eff;">${booking.hotel.name}</h3>
        <p style="margin:5px 0;color:#666;">${booking.hotel.location}</p>
        ${booking.hotel.rating ? `<p style="margin:5px 0;">⭐ Rating: ${booking.hotel.rating}/5</p>` : ''}
        ${booking.hotel.phone ? `<p style="margin:5px 0;">📞 ${booking.hotel.phone}</p>` : ''}
        ${booking.hotel.website ? `<p style="margin:5px 0;">🌐 <a href="${booking.hotel.website}">${booking.hotel.website}</a></p>` : ''}
        <div style="margin-top:15px;">
          <strong>Amenities:</strong><br>
          <div style="margin-top:8px;">${amenitiesHtml}</div>
        </div>
      </div>

      <!-- Stay Details -->
      <div style="background:#e3f2fd;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">📅 Stay Details</h2>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;padding:10px;">
            <p style="margin:0;color:#666;font-size:12px;">CHECK-IN</p>
            <p style="margin:5px 0;font-size:18px;font-weight:bold;">${formatDate(checkInDate)}</p>
            <p style="margin:0;color:#4caf50;">${formatTime(15)} onwards</p>
          </div>
          <div style="flex:1;min-width:200px;padding:10px;">
            <p style="margin:0;color:#666;font-size:12px;">CHECK-OUT</p>
            <p style="margin:5px 0;font-size:18px;font-weight:bold;">${formatDate(checkOutDate)}</p>
            <p style="margin:0;color:#f44336;">Before ${formatTime(11)}</p>
          </div>
        </div>
        <p style="margin:15px 0 0;text-align:center;font-size:18px;">
          <strong>${booking.nights} Night${booking.nights > 1 ? 's' : ''}</strong>
        </p>
      </div>

      <!-- Pricing -->
      <div style="background:#fce4ec;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">💰 Pricing Summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;">Nightly Rate</td>
            <td style="padding:8px 0;text-align:right;">$${booking.hotel.price.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;">× ${booking.nights} night${booking.nights > 1 ? 's' : ''}</td>
            <td style="padding:8px 0;text-align:right;">$${booking.subtotal.toFixed(2)}</td>
          </tr>
          <tr style="color:#4caf50;">
            <td style="padding:8px 0;">FunStay Discount (${booking.discountPct.toFixed(1)}%)</td>
            <td style="padding:8px 0;text-align:right;">-$${(booking.subtotal - booking.total).toFixed(2)}</td>
          </tr>
          <tr style="border-top:2px solid #ddd;font-size:20px;font-weight:bold;">
            <td style="padding:15px 0;">TOTAL</td>
            <td style="padding:15px 0;text-align:right;color:#6b4eff;">$${booking.total.toFixed(2)} USD</td>
          </tr>
        </table>
        <p style="margin:10px 0 0;font-size:12px;color:#666;">* Taxes and fees may apply at checkout</p>
      </div>

      <!-- Travel Logistics -->
      <div style="background:#e8f5e9;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">🚗 Travel Logistics</h2>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;">
          <div>
            <p style="margin:0;font-weight:bold;">🅿️ Parking</p>
            <p style="margin:5px 0;font-size:14px;">Valet & Self-parking available<br>$25/day</p>
          </div>
          <div>
            <p style="margin:0;font-weight:bold;">✈️ Airport Shuttle</p>
            <p style="margin:5px 0;font-size:14px;">Available upon request<br>Contact front desk</p>
          </div>
          <div>
            <p style="margin:0;font-weight:bold;">🧳 Luggage Storage</p>
            <p style="margin:5px 0;font-size:14px;">Complimentary<br>Before check-in & after checkout</p>
          </div>
          <div>
            <p style="margin:0;font-weight:bold;">⏰ Early/Late Options</p>
            <p style="margin:5px 0;font-size:14px;">Early check-in available<br>Late checkout upon request</p>
          </div>
        </div>
      </div>

      <!-- Policies -->
      <div style="background:#fff8e1;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">📋 Important Policies</h2>
        <ul style="margin:0;padding-left:20px;">
          <li style="margin:8px 0;">Free cancellation up to 24 hours before check-in</li>
          <li style="margin:8px 0;">Government-issued photo ID required at check-in</li>
          <li style="margin:8px 0;">Credit card required for incidentals</li>
          <li style="margin:8px 0;">Non-smoking property</li>
          <li style="margin:8px 0;">Pet-friendly rooms available upon request</li>
        </ul>
      </div>

      ${booking.guestLocation ? `
      <!-- Location Info -->
      <div style="background:#e1f5fe;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">📍 Booking Location</h2>
        <p style="margin:5px 0;">Latitude: ${booking.guestLocation.lat.toFixed(6)}</p>
        <p style="margin:5px 0;">Longitude: ${booking.guestLocation.lng.toFixed(6)}</p>
        <p style="margin:5px 0;">Accuracy: ±${Math.round(booking.guestLocation.accuracy)}m</p>
      </div>
      ` : ''}

      <!-- Action History -->
      <div style="background:#f3e5f5;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">📊 Recent Activity</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#e1bee7;">
              <th style="padding:10px;text-align:left;">Time</th>
              <th style="padding:10px;text-align:left;">Category</th>
              <th style="padding:10px;text-align:left;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${actionsHtml}
          </tbody>
        </table>
      </div>

      <!-- Emergency Contacts -->
      <div style="background:#ffebee;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 15px;color:#1f2444;">🆘 Emergency Contacts</h2>
        <p style="margin:5px 0;">🏨 Hotel Front Desk: +1 (555) 123-4567</p>
        <p style="margin:5px 0;">🛎️ Concierge: +1 (555) 123-4568</p>
        <p style="margin:5px 0;">📞 FunStay Support: +1 (800) FUNSTAY</p>
        <p style="margin:5px 0;">🚨 Emergency Services: 911</p>
      </div>

      <!-- CTA Buttons -->
      <div style="text-align:center;padding:20px;">
        <a href="#" style="display:inline-block;background:#6b4eff;color:#fff;padding:15px 30px;border-radius:25px;text-decoration:none;margin:5px;">Add to Calendar</a>
        <a href="#" style="display:inline-block;background:#ff4fa3;color:#fff;padding:15px 30px;border-radius:25px;text-decoration:none;margin:5px;">Manage Booking</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#1f2444;color:#fff;padding:30px;text-align:center;">
      <p style="margin:0 0 10px;">🌈 FunStay — Colorful Hotel Reservations</p>
      <p style="margin:0;font-size:12px;opacity:0.7;">
        This is an automated booking confirmation. Please do not reply to this email.<br>
        For assistance, contact support@funstay.local
      </p>
      <p style="margin:15px 0 0;font-size:11px;opacity:0.5;">
        Booking ID: ${booking.bookingRef} | Generated: ${new Date().toISOString()}
      </p>
    </div>
  </div>
</body>
</html>`;
  },

  buildTextEmail(booking, checkInDate, checkOutDate, formatDate, formatTime, recentActions) {
    const actionsText = recentActions.length > 0 ?
      recentActions.slice(-10).map(a => `  ${a.time} | ${a.category} | ${a.action}`).join('\n') :
      '  No recent actions';

    return `
================================================================================
                           🌈 FUNSTAY BOOKING CONFIRMATION
================================================================================

✅ BOOKING CONFIRMED
Reference: ${booking.bookingRef}
Created: ${new Date(booking.createdAt).toLocaleString()}

--------------------------------------------------------------------------------
                              GUEST INFORMATION
--------------------------------------------------------------------------------
Name: ${booking.guest.name}
Email: ${booking.guest.email || 'Not provided'}
Guest Count: ${booking.guests}
Account Type: ${booking.guest.type}

--------------------------------------------------------------------------------
                               HOTEL DETAILS
--------------------------------------------------------------------------------
Hotel: ${booking.hotel.name}
Location: ${booking.hotel.location}
${booking.hotel.rating ? `Rating: ${booking.hotel.rating}/5 stars` : ''}
${booking.hotel.phone ? `Phone: ${booking.hotel.phone}` : ''}
${booking.hotel.website ? `Website: ${booking.hotel.website}` : ''}

Amenities: ${booking.hotel.amenities.join(', ')}

--------------------------------------------------------------------------------
                                STAY DETAILS
--------------------------------------------------------------------------------
CHECK-IN:  ${formatDate(checkInDate)} at ${formatTime(15)}
CHECK-OUT: ${formatDate(checkOutDate)} by ${formatTime(11)}

Total Nights: ${booking.nights}

--------------------------------------------------------------------------------
                              PRICING SUMMARY
--------------------------------------------------------------------------------
Nightly Rate:           $${booking.hotel.price.toFixed(2)}
× ${booking.nights} nights:             $${booking.subtotal.toFixed(2)}
FunStay Discount (${booking.discountPct.toFixed(1)}%): -$${(booking.subtotal - booking.total).toFixed(2)}
----------------------------------------
TOTAL:                  $${booking.total.toFixed(2)} USD

* Taxes and fees may apply at checkout

--------------------------------------------------------------------------------
                             TRAVEL LOGISTICS
--------------------------------------------------------------------------------
Parking:          Valet & Self-parking available ($25/day)
Airport Shuttle:  Available upon request (contact front desk)
Luggage Storage:  Complimentary before check-in & after checkout
Early Check-in:   Available upon request
Late Check-out:   Available upon request

--------------------------------------------------------------------------------
                            IMPORTANT POLICIES
--------------------------------------------------------------------------------
• Free cancellation up to 24 hours before check-in
• Government-issued photo ID required at check-in
• Credit card required for incidentals
• Non-smoking property
• Pet-friendly rooms available upon request

${booking.guestLocation ? `
--------------------------------------------------------------------------------
                            BOOKING LOCATION
--------------------------------------------------------------------------------
Latitude: ${booking.guestLocation.lat.toFixed(6)}
Longitude: ${booking.guestLocation.lng.toFixed(6)}
Accuracy: ±${Math.round(booking.guestLocation.accuracy)}m
` : ''}
--------------------------------------------------------------------------------
                             RECENT ACTIVITY
--------------------------------------------------------------------------------
${actionsText}

--------------------------------------------------------------------------------
                           EMERGENCY CONTACTS
--------------------------------------------------------------------------------
Hotel Front Desk:    +1 (555) 123-4567
Concierge:           +1 (555) 123-4568
FunStay Support:     +1 (800) FUNSTAY
Emergency Services:  911

================================================================================
       🌈 FunStay — Colorful Hotel Reservations
       
This is an automated booking confirmation.
For assistance, contact support@funstay.local

Booking ID: ${booking.bookingRef}
Generated: ${new Date().toISOString()}
================================================================================
`;
  },

  previewEmail(booking) {
    const emailData = this.generateBookingConfirmationEmail(booking, state.actionLog);
    return emailData;
  },

  downloadEmailAsFile(booking) {
    const emailData = this.generateBookingConfirmationEmail(booking, state.actionLog);
    
    // Download HTML version
    const htmlBlob = new Blob([emailData.htmlBody], { type: 'text/html;charset=utf-8' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const htmlLink = document.createElement('a');
    htmlLink.href = htmlUrl;
    htmlLink.download = `${booking.bookingRef}-confirmation.html`;
    htmlLink.click();
    URL.revokeObjectURL(htmlUrl);

    // Download logistics JSON
    const logisticsBlob = new Blob([JSON.stringify(emailData.logistics, null, 2)], { type: 'application/json' });
    const logisticsUrl = URL.createObjectURL(logisticsBlob);
    const logisticsLink = document.createElement('a');
    logisticsLink.href = logisticsUrl;
    logisticsLink.download = `${booking.bookingRef}-logistics.json`;
    logisticsLink.click();
    URL.revokeObjectURL(logisticsUrl);

    return emailData;
  },

  showEmailPreviewModal(booking) {
    const emailData = this.generateBookingConfirmationEmail(booking, state.actionLog);
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'emailPreviewModal';
    modal.className = 'email-preview-modal';
    modal.innerHTML = `
      <div class="email-preview-content">
        <div class="email-preview-header">
          <h2>📧 Action Alert Status Email Preview</h2>
          <button class="email-preview-close" onclick="document.getElementById('emailPreviewModal').remove()">×</button>
        </div>
        <div class="email-preview-tabs">
          <button class="email-tab active" data-tab="preview">Preview</button>
          <button class="email-tab" data-tab="logistics">Logistics Data</button>
          <button class="email-tab" data-tab="text">Text Version</button>
        </div>
        <div class="email-preview-body">
          <div class="email-tab-content active" id="tab-preview">
            <iframe srcdoc="${emailData.htmlBody.replace(/"/g, '&quot;')}" style="width:100%;height:500px;border:1px solid #ddd;border-radius:8px;"></iframe>
          </div>
          <div class="email-tab-content" id="tab-logistics">
            <pre style="background:#f5f5f5;padding:15px;border-radius:8px;overflow:auto;max-height:500px;font-size:12px;">${JSON.stringify(emailData.logistics, null, 2)}</pre>
          </div>
          <div class="email-tab-content" id="tab-text">
            <pre style="background:#f5f5f5;padding:15px;border-radius:8px;overflow:auto;max-height:500px;font-size:12px;white-space:pre-wrap;">${emailData.textBody}</pre>
          </div>
        </div>
        <div class="email-preview-actions">
          <button class="btn btn-primary" id="downloadEmailBtn">📥 Download Email Files</button>
          <button class="btn btn-secondary" onclick="document.getElementById('emailPreviewModal').remove()">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Tab switching
    modal.querySelectorAll('.email-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.email-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.email-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // Download button
    document.getElementById('downloadEmailBtn').addEventListener('click', () => {
      this.downloadEmailAsFile(booking);
      ActionTracker.trackUI('email_downloaded', { bookingRef: booking.bookingRef });
    });

    ActionTracker.trackUI('email_preview_opened', { bookingRef: booking.bookingRef });
    return emailData;
  }
};

class OfflineVault {
  static dbName = 'FunStayOfflineDB';
  static dbVersion = 1;
  static storeName = 'compressed';
  static chunkSize = 300000;
  static db = null;

  static async open() {
    if (OfflineVault.db) return OfflineVault.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(OfflineVault.dbName, OfflineVault.dbVersion);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(OfflineVault.storeName)) {
          db.createObjectStore(OfflineVault.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = event => {
        OfflineVault.db = event.target.result;
        resolve(OfflineVault.db);
      };
      request.onerror = event => reject(event.target.error);
    });
  }

  static async write(record) {
    const db = await OfflineVault.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OfflineVault.storeName, 'readwrite');
      tx.objectStore(OfflineVault.storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = event => reject(event.target.error);
    });
  }

  static async read(key) {
    const db = await OfflineVault.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OfflineVault.storeName, 'readonly');
      const req = tx.objectStore(OfflineVault.storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = event => reject(event.target.error);
    });
  }

  static toBase64Utf8(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  static fromBase64Utf8(text) {
    return decodeURIComponent(escape(atob(text)));
  }

  static async compress(text) {
    if (typeof CompressionStream === 'undefined') {
      return { payload: OfflineVault.toBase64Utf8(text), compressed: false };
    }
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    bytes.forEach(b => {
      binary += String.fromCharCode(b);
    });
    return { payload: btoa(binary), compressed: true };
  }

  static async decompress(base64, compressed) {
    if (!compressed || typeof DecompressionStream === 'undefined') {
      return OfflineVault.fromBase64Utf8(base64);
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  static split(payload) {
    const chunks = [];
    for (let i = 0; i < payload.length; i += OfflineVault.chunkSize) {
      chunks.push(payload.slice(i, i + OfflineVault.chunkSize));
    }
    return chunks;
  }

  static async set(key, value) {
    const raw = JSON.stringify(value);
    const { payload, compressed } = await OfflineVault.compress(raw);
    const chunks = OfflineVault.split(payload);
    const chunkKeys = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkKey = `${key}::${i}`;
      chunkKeys.push(chunkKey);
      await OfflineVault.write({ key: chunkKey, value: chunks[i], type: 'chunk' });
    }

    await OfflineVault.write({
      key,
      type: 'manifest',
      compressed,
      chunkKeys,
      totalChunks: chunks.length,
      updatedAt: new Date().toISOString()
    });
  }

  static async get(key) {
    const manifest = await OfflineVault.read(key);
    if (!manifest || manifest.type !== 'manifest') return null;

    let payload = '';
    for (const chunkKey of manifest.chunkKeys) {
      const record = await OfflineVault.read(chunkKey);
      if (!record) return null;
      payload += record.value;
    }

    const text = await OfflineVault.decompress(payload, manifest.compressed);
    return JSON.parse(text);
  }
}

const config = window.FUNSTAY_CONFIG || {
  google: { clientId: '', mapsApiKey: '' },
  wallet: { issuerId: '', classId: 'funstay.hotel.class', savePassEndpoint: '' }
};

const el = {
  googleSignInBtn: document.getElementById('googleSignInBtn'),
  googleSignInContainer: document.getElementById('googleSignInContainer'),
  createAccountBtn: document.getElementById('createAccountBtn'),
  guestBtn: document.getElementById('guestBtn'),
  accountStatus: document.getElementById('accountStatus'),
  discountDetails: document.getElementById('discountDetails'),
  countrySelect: document.getElementById('countrySelect'),
  searchInput: document.getElementById('searchInput'),
  autocompleteList: document.getElementById('autocompleteList'),
  map: document.getElementById('map'),
  checkIn: document.getElementById('checkIn'),
  checkOut: document.getElementById('checkOut'),
  maxPrice: document.getElementById('maxPrice'),
  guestCount: document.getElementById('guestCount'),
  searchBtn: document.getElementById('searchBtn'),
  results: document.getElementById('results'),
  bookingSummary: document.getElementById('bookingSummary'),
  googleCalendarBtn: document.getElementById('googleCalendarBtn'),
  appleCalendarBtn: document.getElementById('appleCalendarBtn'),
  walletBtn: document.getElementById('walletBtn'),
  offlineStatus: document.getElementById('offlineStatus')
};

const appLog = {
  entries: [],
  max: 500,
  push(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, message, meta };
    this.entries.push(entry);
    if (this.entries.length > this.max) this.entries.shift();
    const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logger('[FunStay]', message, meta);
  }
};

function renderConnectivity() {
  if (!el.offlineStatus) return;
  const online = navigator.onLine;
  const previousOnline = el.offlineStatus.dataset.online === 'true';
  el.offlineStatus.classList.toggle('offline', !online);
  el.offlineStatus.innerHTML = online
    ? '🟢 Online. PWA cache + offline vault are active.'
    : '🟠 Offline. Running fully from local cache/storage (no backend required).';
  el.offlineStatus.dataset.online = String(online);
  
  // Track network state changes
  if (previousOnline !== online) {
    ActionTracker.trackNetwork(online ? 'connection_restored' : 'connection_lost', {
      online,
      timestamp: new Date().toISOString()
    });
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch {
  }
}

async function persistOfflineSnapshot() {
  const snapshot = {
    account: state.account,
    visitLog: state.visitLog,
    booking: state.booking,
    gps: state.gps,
    activeResults: state.activeResults,
    timestamp: new Date().toISOString()
  };
  await OfflineVault.set('funstay.snapshot.v1', snapshot).catch(() => null);
}

async function hydrateFromOfflineSnapshot() {
  const snapshot = await OfflineVault.get('funstay.snapshot.v1').catch(() => null);
  if (!snapshot) return;
  if (!state.account && snapshot.account) state.account = snapshot.account;
  if ((!state.visitLog || !state.visitLog.length) && Array.isArray(snapshot.visitLog)) state.visitLog = snapshot.visitLog;
  if (!state.booking && snapshot.booking) state.booking = snapshot.booking;
  if (snapshot.gps) state.gps = { ...state.gps, ...snapshot.gps };
}

async function refreshGeolocationPermission() {
  if (!('permissions' in navigator) || !navigator.permissions?.query) return;
  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
    state.gps.permission = permissionStatus.state;
    permissionStatus.onchange = () => {
      state.gps.permission = permissionStatus.state;
      appLog.push('info', 'GPS permission changed', { state: state.gps.permission });
    };
  } catch {
  }
}

function getCurrentPositionPromise(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function requestClientLocation(reason = 'general', options = {}) {
  const { forcePrompt = false, maxAgeMs = 120000, timeout = 10000 } = options;
  if (!('geolocation' in navigator)) {
    state.gps.lastError = 'Geolocation unsupported';
    return null;
  }

  const now = Date.now();
  const last = state.gps.lastKnown?.timestamp || 0;
  if (!forcePrompt && state.gps.lastKnown && now - last < maxAgeMs) {
    return state.gps.lastKnown;
  }

  state.gps.lastRequestedAt = new Date().toISOString();

  try {
    const position = await getCurrentPositionPromise({
      enableHighAccuracy: true,
      timeout,
      maximumAge: 60000
    });
    const value = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
      capturedFor: reason
    };
    state.gps.lastKnown = value;
    state.gps.lastError = null;
    appLog.push('info', 'GPS captured', { reason, accuracy: value.accuracy });
    persistOfflineSnapshot().catch(() => null);
    return value;
  } catch (error) {
    state.gps.lastError = error?.message || 'Location unavailable';
    appLog.push('warn', 'GPS capture failed', { reason, error: state.gps.lastError });
    persistOfflineSnapshot().catch(() => null);
    return null;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const found = [...document.querySelectorAll('script')].find(s => s.src === src);
    if (found) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function parseJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function initializeGoogleIdentity() {
  if (!config.google.clientId) return;
  await loadScript('https://accounts.google.com/gsi/client');
  if (!window.google?.accounts?.id) return;

  window.google.accounts.id.initialize({
    client_id: config.google.clientId,
    callback: response => {
      const payload = parseJwtPayload(response.credential || '');
      if (!payload) {
        setAccountStatus('Google sign-in failed: invalid credential payload.');
        return;
      }
      state.account = {
        type: 'google',
        email: payload.email || null,
        name: payload.name || payload.given_name || 'Google User',
        sub: payload.sub || null,
        picture: payload.picture || null
      };
      saveState();
      setAccountStatus(`Signed in with Google: ${state.account.name}${state.account.email ? ` (${state.account.email})` : ''}`);
    }
  });

  el.googleSignInContainer.style.display = 'block';
  el.googleSignInContainer.innerHTML = '';
  window.google.accounts.id.renderButton(el.googleSignInContainer, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    shape: 'pill',
    text: 'signin_with',
    logo_alignment: 'left'
  });

  state.googleIdentityReady = true;
}

async function initializeGooglePlaces() {
  if (!config.google.mapsApiKey) return;
  if (window.google?.maps?.places) {
    setupGoogleMapAndPlaces();
    return;
  }

  const callbackName = '__funstayPlacesInit';
  await new Promise((resolve, reject) => {
    window[callbackName] = () => resolve();
    const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.google.mapsApiKey)}&libraries=places&callback=${callbackName}`;
    loadScript(src).catch(reject);
    setTimeout(() => reject(new Error('Timed out loading Google Maps Places API.')), 12000);
  }).catch(() => null);

  if (window.google?.maps?.places) {
    setupGoogleMapAndPlaces();
  }
}

function setupGoogleMapAndPlaces() {
  if (!window.google?.maps || !el.map) return;

  const countryDef = countries[state.selectedCountry] || countries.us;
  state.map = new window.google.maps.Map(el.map, {
    zoom: countryDef.zoom,
    center: countryDef.center,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  state.infoWindow = new window.google.maps.InfoWindow();
  state.placesService = new window.google.maps.places.PlacesService(state.map);
  state.cityAutocomplete = new window.google.maps.places.Autocomplete(el.searchInput, {
    types: ['(cities)'],
    fields: ['geometry', 'name', 'formatted_address', 'place_id']
  });
  applyCountryRestriction();

  state.cityAutocomplete.addListener('place_changed', () => {
    const place = state.cityAutocomplete.getPlace();
    if (place?.geometry?.location) {
      state.selectedPlace = place;
      state.map.panTo(place.geometry.location);
      state.map.setZoom(13);
      runApiHotelSearchFromPlace(place).catch(error => {
        appLog.push('error', 'API search failed from place', { error: String(error) });
      });
    }
  });

  state.googlePlacesReady = true;
  appLog.push('info', 'Google Places initialized', { country: state.selectedCountry });
}

function applyCountryRestriction() {
  if (!state.cityAutocomplete) return;
  const c = state.selectedCountry;
  if (c === 'all') {
    state.cityAutocomplete.setComponentRestrictions({ country: [] });
  } else {
    state.cityAutocomplete.setComponentRestrictions({ country: c });
  }
}

function setCountryScope() {
  const previousCountry = state.selectedCountry;
  state.selectedCountry = el.countrySelect?.value || 'us';
  const countryDef = countries[state.selectedCountry] || countries.us;
  if (state.map) {
    state.map.setCenter(countryDef.center);
    state.map.setZoom(countryDef.zoom);
  }
  applyCountryRestriction();
  clearMapMarkers();
  appLog.push('info', 'Country scope updated', { country: state.selectedCountry });
  ActionTracker.trackUI('country_changed', { 
    previousCountry, 
    newCountry: state.selectedCountry,
    center: countryDef.center,
    zoom: countryDef.zoom
  });
}

function clearMapMarkers() {
  state.mapMarkers.forEach(marker => marker.setMap(null));
  state.mapMarkers = [];
}

function hashNumber(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function estimateNightlyPrice(place) {
  if (typeof place.price_level === 'number') {
    return 120 + place.price_level * 90;
  }
  const seed = hashNumber(place.place_id || place.name || 'hotel');
  return 120 + (seed % 360);
}

function inferAmenities(place) {
  const types = place.types || [];
  const amenities = new Set(['wifi']);
  if (types.includes('spa') || /spa/i.test(place.name || '')) amenities.add('spa');
  if (types.includes('gym') || /fitness|gym/i.test(place.name || '')) amenities.add('gym');
  if (/resort|beach|bay|ocean|pool/i.test(place.name || '')) amenities.add('pool');
  if (/parking|motor|inn/i.test(place.name || '')) amenities.add('parking');
  if (/breakfast|suite|hotel/i.test(place.name || '')) amenities.add('breakfast');
  return [...amenities];
}

function placeToHotelModel(place, index = 0) {
  const id = `api-${place.place_id || hashNumber(place.name || String(index))}`;
  return {
    id,
    name: place.name || 'Hotel',
    location: place.vicinity || place.formatted_address || 'Unknown location',
    price: estimateNightlyPrice(place),
    amenities: inferAmenities(place),
    rooms: 2 + (hashNumber(id) % 7),
    rating: place.rating || null,
    website: place.website || null,
    phone: place.formatted_phone_number || null,
    placeId: place.place_id || null,
    source: 'google_places'
  };
}

function nearbySearchPromise(request) {
  return new Promise(resolve => {
    const collected = [];
    const searchPage = () => {
      state.placesService.nearbySearch(request, (results, status, pagination) => {
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK;
        if (status === ok && results?.length) {
          collected.push(...results);
          if (pagination?.hasNextPage && collected.length < 60) {
            setTimeout(() => pagination.nextPage(), 250);
            return;
          }
        }
        resolve(collected);
      });
    };
    searchPage();
  });
}

function placeDetailsPromise(placeId) {
  return new Promise(resolve => {
    if (!placeId) {
      resolve(null);
      return;
    }
    state.placesService.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'rating', 'website', 'formatted_phone_number', 'price_level', 'types', 'vicinity']
      },
      (place, status) => {
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK;
        if (status === ok && place) {
          resolve(place);
          return;
        }
        resolve(null);
      }
    );
  });
}

async function processInBatches(items, batchSize, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((item, idx) => worker(item, i + idx)));
    settled.forEach(result => {
      if (result.status === 'fulfilled') results.push(result.value);
    });
  }
  return results;
}

async function enrichNearbyResults(nearbyResults) {
  const details = await processInBatches(nearbyResults, 8, async result => {
    const detail = await placeDetailsPromise(result.place_id);
    return detail || result;
  });
  return details.filter(Boolean);
}

function updateActiveHotelIndex() {
  state.activeHotelsIndex = Object.fromEntries(state.activeResults.map(h => [String(h.id), h]));
}

function renderMapMarkers(results) {
  if (!state.map) return;
  clearMapMarkers();

  results.slice(0, 26).forEach((place, index) => {
    const location = place.geometry?.location;
    if (!location) return;
    const label = String.fromCharCode('A'.charCodeAt(0) + (index % 26));
    const marker = new window.google.maps.Marker({
      map: state.map,
      position: location,
      animation: window.google.maps.Animation.DROP,
      label
    });
    marker.__place = place;
    marker.addListener('click', () => {
      const p = marker.__place;
      const rating = p.rating ? `⭐ ${p.rating}` : 'No rating';
      state.infoWindow.setContent(`<strong>${p.name || 'Hotel'}</strong><br>${p.vicinity || ''}<br>${rating}`);
      state.infoWindow.open({ map: state.map, anchor: marker });
    });
    state.mapMarkers.push(marker);
  });
}

async function runApiHotelSearchFromPlace(place) {
  if (!state.googlePlacesReady || !state.map || !state.placesService || !place?.geometry?.location) return;
  const request = {
    location: place.geometry.location,
    radius: 6000,
    type: 'lodging'
  };

  appLog.push('info', 'API nearby search start', { placeId: place.place_id || null });
  const nearby = await nearbySearchPromise(request);
  appLog.push('info', 'API nearby search completed', { count: nearby.length });

  const enrichedPlaces = await enrichNearbyResults(nearby);
  renderMapMarkers(enrichedPlaces);

  const models = enrichedPlaces.map((result, index) => placeToHotelModel(result, index));
  state.activeResults = models;
  updateActiveHotelIndex();
  renderResults();
  persistOfflineSnapshot().catch(() => null);
}

async function runApiHotelSearchFromCoords(coords) {
  if (!state.googlePlacesReady || !state.map || !state.placesService || !coords) return false;
  const location = new window.google.maps.LatLng(coords.lat, coords.lng);
  state.map.panTo(location);
  state.map.setZoom(14);

  const request = {
    location,
    radius: 7000,
    type: 'lodging'
  };

  appLog.push('info', 'API nearby search from GPS start', { lat: coords.lat, lng: coords.lng });
  const nearby = await nearbySearchPromise(request);
  if (!nearby.length) {
    appLog.push('warn', 'API nearby search from GPS returned no results');
    return false;
  }

  const enrichedPlaces = await enrichNearbyResults(nearby);
  renderMapMarkers(enrichedPlaces);
  const models = enrichedPlaces.map((result, index) => placeToHotelModel(result, index));
  state.activeResults = models;
  updateActiveHotelIndex();
  renderResults();
  persistOfflineSnapshot().catch(() => null);
  return true;
}

function todayPlus(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function initDates() {
  el.checkIn.value = todayPlus(7);
  el.checkOut.value = todayPlus(10);
}

function saveState() {
  localStorage.setItem('funstay_account', JSON.stringify(state.account));
  localStorage.setItem('funstay_visit_log', JSON.stringify(state.visitLog));
  localStorage.setItem('funstay_booking', JSON.stringify(state.booking));
  localStorage.setItem('funstay_action_log', JSON.stringify(state.actionLog));
  persistOfflineSnapshot().catch(() => null);
}

function logVisit() {
  const now = Date.now();
  state.visitLog.push(now);
  state.visitLog = state.visitLog.slice(-500);
  saveState();
}

function computeDiscount() {
  const visitCount = Math.max(0, state.visitLog.length - 1);
  const onePercentLoyalty = visitCount;
  const now = Date.now();
  const weekCount = state.visitLog.filter(ts => now - ts <= 7 * 24 * 60 * 60 * 1000).length;
  const monthCount = state.visitLog.filter(ts => now - ts <= 30 * 24 * 60 * 60 * 1000).length;
  const periodBonus = monthCount >= 4 ? 7.5 : weekCount >= 2 ? 5 : 0;
  const total = Math.min(40, onePercentLoyalty + periodBonus);
  return {
    onePercentLoyalty,
    periodBonus,
    weekCount,
    monthCount,
    total
  };
}

function renderDiscount() {
  const d = computeDiscount();
  el.discountDetails.innerHTML = [
    `Visits tracked: <strong>${state.visitLog.length}</strong>`,
    `Return discount: <strong>${d.onePercentLoyalty.toFixed(1)}%</strong>`,
    `Weekly/Monthly bonus: <strong>${d.periodBonus.toFixed(1)}%</strong>`,
    `Current total discount: <strong>${d.total.toFixed(1)}%</strong>`
  ].join('<br>');
}

function setAccountStatus(msg) {
  el.accountStatus.textContent = msg;
}

function signInGoogleMock() {
  ActionTracker.trackAuth('google_signin_initiated', { method: 'mock' });
  if (state.googleIdentityReady && window.google?.accounts?.id) {
    window.google.accounts.id.prompt();
    ActionTracker.trackAuth('google_signin_prompt_shown', { googleIdentityReady: true });
    return;
  }
  const email = prompt('Google Sign-In demo: enter Google email');
  if (!email) {
    ActionTracker.trackAuth('google_signin_cancelled', { reason: 'user_cancelled' });
    return;
  }
  state.account = { type: 'google', email, name: email.split('@')[0] };
  saveState();
  setAccountStatus(`Signed in as ${state.account.email} (Google demo mode)`);
  ActionTracker.trackAuth('google_signin_success', { email: state.account.email, name: state.account.name });
}

function createAccountMock() {
  ActionTracker.trackAuth('create_account_initiated', {});
  const email = prompt('Create account: email');
  if (!email) {
    ActionTracker.trackAuth('create_account_cancelled', { step: 'email_entry' });
    return;
  }
  const name = prompt('Create account: display name') || email.split('@')[0];
  state.account = { type: 'local', email, name };
  saveState();
  setAccountStatus(`Account created: ${name} (${email})`);
  ActionTracker.trackAuth('create_account_success', { email, name, accountType: 'local' });
}

function continueAsGuest() {
  ActionTracker.trackAuth('guest_mode_selected', {});
  state.account = { type: 'guest', email: null, name: 'Guest Traveler' };
  saveState();
  setAccountStatus('Continuing as guest. Booking is enabled.');
  ActionTracker.trackAuth('guest_session_started', { name: 'Guest Traveler' });
}

function applyAutocomplete() {
  const q = el.searchInput.value.trim().toLowerCase();
  el.autocompleteList.innerHTML = '';
  if (!q) return;

  if (state.googlePlacesReady && state.placesService && q.length >= 2) {
    const token = Date.now();
    state.autocompleteRequestToken = token;
    state.placesService.getPlacePredictions({ input: q }, (predictions, status) => {
      if (state.autocompleteRequestToken !== token) return;
      const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK;
      if (status !== ok || !predictions?.length) {
        renderLocalAutocomplete(q);
        return;
      }
      el.autocompleteList.innerHTML = '';
      predictions.slice(0, 6).forEach(prediction => {
        const li = document.createElement('li');
        li.textContent = prediction.description;
        li.addEventListener('click', () => {
          el.searchInput.value = prediction.description;
          el.autocompleteList.innerHTML = '';
        });
        el.autocompleteList.appendChild(li);
      });
    });
    return;
  }

  renderLocalAutocomplete(q);
}

function renderLocalAutocomplete(q) {
  const query = q.toLowerCase();
  el.autocompleteList.innerHTML = '';
  if (!query) return;

  const options = hotels
    .filter(h => h.name.toLowerCase().includes(query) || h.location.toLowerCase().includes(query))
    .slice(0, 6);

  options.forEach(hotel => {
    const li = document.createElement('li');
    li.textContent = `${hotel.name} — ${hotel.location}`;
    li.addEventListener('click', () => {
      el.searchInput.value = `${hotel.name} ${hotel.location}`;
      el.autocompleteList.innerHTML = '';
    });
    el.autocompleteList.appendChild(li);
  });
}

function selectedAmenities() {
  return [...document.querySelectorAll('.amenities input:checked')].map(x => x.value);
}

function parseDate(input) {
  const d = new Date(input + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start, end) {
  const ms = end - start;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

async function runSearch() {
  const query = el.searchInput.value.trim().toLowerCase();
  const maxPrice = Number(el.maxPrice.value || 0);
  const guests = Number(el.guestCount.value || 1);
  const wants = selectedAmenities();

  ActionTracker.trackSearch('search_initiated', {
    query,
    maxPrice,
    guests,
    amenities: wants,
    country: state.selectedCountry,
    googlePlacesReady: state.googlePlacesReady
  });

  if (state.googlePlacesReady && !query) {
    ActionTracker.trackSearch('location_based_search_attempt', { reason: 'empty_query' });
    const coords = await requestClientLocation('search-empty-query', { forcePrompt: false });
    if (coords) {
      const used = await runApiHotelSearchFromCoords(coords);
      if (used) {
        ActionTracker.trackSearch('location_based_search_success', { lat: coords.lat, lng: coords.lng });
        return;
      }
    }
  }

  if (state.googlePlacesReady && state.selectedPlace && query) {
    ActionTracker.trackSearch('place_based_search', { placeId: state.selectedPlace.place_id, placeName: state.selectedPlace.name });
    await runApiHotelSearchFromPlace(state.selectedPlace).catch(() => null);
  }

  const base = state.activeResults?.length ? state.activeResults : hotels;
  const results = base.filter(h => {
    const matchText = !query || h.name.toLowerCase().includes(query) || h.location.toLowerCase().includes(query);
    const matchPrice = h.price <= maxPrice;
    const matchAmenities = wants.every(a => h.amenities.includes(a));
    const matchCapacity = h.rooms >= 1 && guests <= 8;
    return matchText && matchPrice && matchAmenities && matchCapacity;
  });

  state.activeResults = results;
  updateActiveHotelIndex();
  renderResults();
  persistOfflineSnapshot().catch(() => null);

  ActionTracker.trackSearch('search_completed', {
    query,
    resultsCount: results.length,
    filters: { maxPrice, guests, amenities: wants }
  });
}

function finalPrice(basePrice, nights) {
  const discount = computeDiscount().total;
  const subtotal = basePrice * nights;
  const total = subtotal * (1 - discount / 100);
  return {
    subtotal,
    discount,
    total
  };
}

function renderResults() {
  el.results.innerHTML = '';
  if (!state.activeResults.length) {
    el.results.innerHTML = '<div class="status">No matching hotels. Try broadening your search.</div>';
    return;
  }

  state.activeResults.forEach(hotel => {
    const card = document.createElement('article');
    card.className = 'hotel-card';

    const start = parseDate(el.checkIn.value);
    const end = parseDate(el.checkOut.value);
    const nights = start && end && end > start ? daysBetween(start, end) : 1;
    const quote = finalPrice(hotel.price, nights);

    card.innerHTML = `
      <div class="hotel-head">
        <strong>${hotel.name}</strong>
        <strong>$${hotel.price}/night</strong>
      </div>
      <div>${hotel.location}</div>
      <div class="hotel-tags">
        ${hotel.amenities.map(a => `<span class="tag">${a}</span>`).join('')}
      </div>
      <div class="status">${nights} night(s) • Subtotal: $${quote.subtotal.toFixed(2)} • Discount: ${quote.discount.toFixed(1)}% • Total: <strong>$${quote.total.toFixed(2)}</strong></div>
      <button class="btn btn-primary" data-book="${hotel.id}">Book Room</button>
    `;

    el.results.appendChild(card);
  });

  [...document.querySelectorAll('[data-book]')].forEach(btn => {
    btn.addEventListener('click', () => {
      const hotelId = String(btn.getAttribute('data-book'));
      createBooking(hotelId).catch(error => appLog.push('error', 'Booking failed', { error: String(error) }));
    });
  });
}

async function createBooking(hotelId) {
  ActionTracker.trackBooking('booking_initiated', { hotelId });
  
  const hotel = state.activeHotelsIndex[String(hotelId)] || hotels.find(h => String(h.id) === String(hotelId));
  if (!hotel) {
    ActionTracker.trackBooking('booking_failed', { reason: 'hotel_not_found', hotelId });
    return;
  }

  const checkIn = parseDate(el.checkIn.value);
  const checkOut = parseDate(el.checkOut.value);
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    alert('Please pick valid check-in and check-out dates.');
    ActionTracker.trackBooking('booking_failed', { reason: 'invalid_dates', checkIn: el.checkIn.value, checkOut: el.checkOut.value });
    return;
  }

  ActionTracker.trackBooking('booking_dates_validated', { checkIn: el.checkIn.value, checkOut: el.checkOut.value });

  const nights = daysBetween(checkIn, checkOut);
  const quote = finalPrice(hotel.price, nights);
  const bookingRef = `FS-${Date.now().toString(36).toUpperCase()}`;
  
  ActionTracker.trackGPS('booking_location_capture_started', { bookingRef });
  const bookingCoords = await requestClientLocation('booking-confirmation', { forcePrompt: false, timeout: 8000 });
  ActionTracker.trackGPS('booking_location_capture_completed', { 
    bookingRef, 
    success: !!bookingCoords,
    coords: bookingCoords ? { lat: bookingCoords.lat, lng: bookingCoords.lng } : null
  });

  state.booking = {
    bookingRef,
    guest: state.account || { type: 'guest', name: 'Guest Traveler', email: null },
    hotel,
    checkIn: el.checkIn.value,
    checkOut: el.checkOut.value,
    guests: Number(el.guestCount.value || 1),
    nights,
    subtotal: quote.subtotal,
    discountPct: quote.discount,
    total: quote.total,
    guestLocation: bookingCoords || state.gps.lastKnown,
    createdAt: new Date().toISOString()
  };

  saveState();
  renderBooking();
  
  ActionTracker.trackBooking('booking_created', {
    bookingRef,
    hotelName: hotel.name,
    hotelLocation: hotel.location,
    checkIn: el.checkIn.value,
    checkOut: el.checkOut.value,
    nights,
    subtotal: quote.subtotal,
    discountPct: quote.discount,
    total: quote.total,
    guestName: state.booking.guest.name,
    guestEmail: state.booking.guest.email,
    hasLocation: !!state.booking.guestLocation
  });
}

function renderBooking() {
  const emailPreviewBtn = document.getElementById('emailPreviewBtn');
  
  if (!state.booking) {
    el.bookingSummary.textContent = 'No booking yet.';
    el.googleCalendarBtn.disabled = true;
    el.appleCalendarBtn.disabled = true;
    el.walletBtn.disabled = true;
    if (emailPreviewBtn) emailPreviewBtn.disabled = true;
    return;
  }

  const b = state.booking;
  el.bookingSummary.innerHTML = [
    `Booking Ref: <strong>${b.bookingRef}</strong>`,
    `Guest: <strong>${b.guest.name}</strong>${b.guest.email ? ` (${b.guest.email})` : ''}`,
    `Hotel: <strong>${b.hotel.name}</strong> — ${b.hotel.location}`,
    `Stay: <strong>${b.checkIn}</strong> to <strong>${b.checkOut}</strong> (${b.nights} nights)`,
    `Total: <strong>$${b.total.toFixed(2)}</strong> (discount ${b.discountPct.toFixed(1)}%)`,
    b.guestLocation ? `Guest GPS: <strong>${b.guestLocation.lat.toFixed(5)}, ${b.guestLocation.lng.toFixed(5)}</strong> (±${Math.round(b.guestLocation.accuracy)}m)` : 'Guest GPS: <strong>Not available</strong>'
  ].join('<br>');

  el.googleCalendarBtn.disabled = false;
  el.appleCalendarBtn.disabled = false;
  el.walletBtn.disabled = false;
  if (emailPreviewBtn) emailPreviewBtn.disabled = false;
}

function isoForCalendar(dateStr, hour = 15) {
  const d = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function openGoogleCalendar() {
  if (!state.booking) return;
  const b = state.booking;
  ActionTracker.trackCalendar('google_calendar_add_initiated', { bookingRef: b.bookingRef });
  const dates = `${isoForCalendar(b.checkIn, 15)}/${isoForCalendar(b.checkOut, 11)}`;
  const text = encodeURIComponent(`Hotel Stay: ${b.hotel.name}`);
  const details = encodeURIComponent(`Booking ${b.bookingRef}\nGuests: ${b.guests}\nTotal: $${b.total.toFixed(2)}`);
  const location = encodeURIComponent(b.hotel.location);
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  window.open(url, '_blank');
  ActionTracker.trackCalendar('google_calendar_opened', { bookingRef: b.bookingRef, hotelName: b.hotel.name });
}

function buildICS() {
  const b = state.booking;
  const dtStart = isoForCalendar(b.checkIn, 15);
  const dtEnd = isoForCalendar(b.checkOut, 11);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FunStay//Reservation//EN',
    'BEGIN:VEVENT',
    `UID:${b.bookingRef}@funstay.local`,
    `DTSTAMP:${isoForCalendar(new Date().toISOString().slice(0, 10), 12)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Hotel Stay - ${b.hotel.name}`,
    `LOCATION:${b.hotel.location}`,
    `DESCRIPTION:Booking ${b.bookingRef} | Guests ${b.guests} | Total $${b.total.toFixed(2)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function downloadICS() {
  if (!state.booking) return;
  ActionTracker.trackCalendar('ics_download_initiated', { bookingRef: state.booking.bookingRef });
  const data = buildICS();
  const blob = new Blob([data], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.booking.bookingRef}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  ActionTracker.trackCalendar('ics_downloaded', { bookingRef: state.booking.bookingRef, filename: `${state.booking.bookingRef}.ics` });
}

function googleWalletPayload() {
  const b = state.booking;
  return {
    issuer: config.wallet.issuerId || 'FunStay Demo Issuer',
    classId: config.wallet.classId || 'funstay.hotel.class',
    objectId: `funstay.hotel.${b.bookingRef.toLowerCase()}`,
    cardTitle: b.hotel.name,
    subTitle: `Ref ${b.bookingRef}`,
    arrival: b.checkIn,
    checkout: b.checkOut,
    doorUnlockEligible: true,
    note: 'Production requires Google Wallet issuer credentials and smart lock integration.'
  };
}

async function addToGoogleWalletDemo() {
  if (!state.booking) return;
  ActionTracker.trackWallet('google_wallet_add_initiated', { bookingRef: state.booking.bookingRef });
  const payload = googleWalletPayload();

  if (config.wallet.savePassEndpoint) {
    ActionTracker.trackWallet('wallet_endpoint_request_started', { endpoint: config.wallet.savePassEndpoint });
    try {
      const response = await fetch(config.wallet.savePassEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.saveUrl) {
          window.open(data.saveUrl, '_blank');
          ActionTracker.trackWallet('wallet_save_url_opened', { bookingRef: state.booking.bookingRef });
          return;
        }
      }
      ActionTracker.trackWallet('wallet_endpoint_request_failed', { status: response.status });
    } catch (error) {
      ActionTracker.trackWallet('wallet_endpoint_error', { error: String(error), offline: !navigator.onLine });
      if (!navigator.onLine) {
        alert('Offline mode: generated local Google Wallet payload instead.');
      }
    }
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.booking.bookingRef}-wallet-pass.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert('Google Wallet demo payload downloaded. Connect issuer API + JWT for live Save to Google Wallet.');
  ActionTracker.trackWallet('wallet_payload_downloaded', { bookingRef: state.booking.bookingRef, filename: `${state.booking.bookingRef}-wallet-pass.json` });
}

function hydrateAccount() {
  if (!state.account) {
    if (config.google.clientId) {
      setAccountStatus('Not signed in. Google Sign-In is configured; you can also continue as guest.');
    } else {
      setAccountStatus('Not signed in. You can still book as guest.');
    }
    return;
  }
  const label = state.account.type === 'google' ? 'Google' : state.account.type === 'local' ? 'Account' : 'Guest';
  setAccountStatus(`${label} session: ${state.account.name}${state.account.email ? ` (${state.account.email})` : ''}`);
}

function bindEvents() {
  el.googleSignInBtn.addEventListener('click', signInGoogleMock);
  el.createAccountBtn.addEventListener('click', createAccountMock);
  el.guestBtn.addEventListener('click', continueAsGuest);
  el.searchInput.addEventListener('input', applyAutocomplete);
  el.searchBtn.addEventListener('click', () => {
    ActionTracker.trackUI('search_button_clicked', {});
    runSearch().catch(error => appLog.push('error', 'Search failed', { error: String(error) }));
  });
  el.googleCalendarBtn.addEventListener('click', openGoogleCalendar);
  el.appleCalendarBtn.addEventListener('click', downloadICS);
  el.walletBtn.addEventListener('click', addToGoogleWalletDemo);
  el.countrySelect?.addEventListener('change', setCountryScope);
  window.addEventListener('online', renderConnectivity);
  window.addEventListener('offline', renderConnectivity);

  // Email preview button
  const emailPreviewBtn = document.getElementById('emailPreviewBtn');
  if (emailPreviewBtn) {
    emailPreviewBtn.addEventListener('click', () => {
      if (state.booking) {
        ActionTracker.trackUI('email_preview_button_clicked', { bookingRef: state.booking.bookingRef });
        ActionAlertEmailGenerator.showEmailPreviewModal(state.booking);
      } else {
        alert('No booking available. Please create a booking first.');
        ActionTracker.trackUI('email_preview_no_booking', {});
      }
    });
  }

  // Date change tracking
  el.checkIn?.addEventListener('change', () => {
    ActionTracker.trackUI('checkin_date_changed', { value: el.checkIn.value });
  });
  el.checkOut?.addEventListener('change', () => {
    ActionTracker.trackUI('checkout_date_changed', { value: el.checkOut.value });
  });

  // Price and guest count tracking
  el.maxPrice?.addEventListener('change', () => {
    ActionTracker.trackUI('max_price_changed', { value: el.maxPrice.value });
  });
  el.guestCount?.addEventListener('change', () => {
    ActionTracker.trackUI('guest_count_changed', { value: el.guestCount.value });
  });

  // Amenity checkbox tracking
  document.querySelectorAll('.amenities input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      ActionTracker.trackUI('amenity_toggled', { 
        amenity: checkbox.value, 
        checked: checkbox.checked 
      });
    });
  });

  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    ActionTracker.trackSystem('visibility_changed', { 
      hidden: document.hidden,
      visibilityState: document.visibilityState
    });
  });

  // Track before unload
  window.addEventListener('beforeunload', () => {
    ActionTracker.trackSystem('page_unload', { 
      actionCount: state.actionLog.length,
      hasBooking: !!state.booking
    });
  });
}

// Render recent actions in the dashboard
function renderRecentActions() {
  const container = document.getElementById('recentActions');
  if (!container) return;

  const recentActions = ActionTracker.getRecentActions(10);
  if (!recentActions.length) {
    container.innerHTML = '<div class="recent-action-item">No actions recorded yet.</div>';
    return;
  }

  container.innerHTML = recentActions.reverse().map(action => {
    const time = new Date(action.timestamp).toLocaleTimeString();
    return `
      <div class="recent-action-item">
        <span class="action-time">${time}</span>
        <span class="action-category">${action.category}</span>
        <strong>${action.action}</strong>
      </div>
    `;
  }).join('');
}

// Update action stats display
function updateActionStats() {
  const summary = ActionTracker.getActionSummary();
  const statElements = document.querySelectorAll('.action-stat');
  
  const categoryLabels = {
    'authentication': '🔐 Auth',
    'search': '🔍 Search',
    'booking': '📅 Booking',
    'calendar': '📆 Calendar',
    'wallet': '💳 Wallet',
    'network': '🌐 Network',
    'location': '📍 Location',
    'user_interface': '🖱️ UI'
  };

  statElements.forEach(el => {
    const text = el.textContent;
    Object.entries(categoryLabels).forEach(([key, label]) => {
      if (text.includes(label.split(' ')[1]) || text.includes(label)) {
        const count = summary[key] || 0;
        el.textContent = `${label}: ${count}`;
      }
    });
  });
}

async function init() {
  ActionTracker.trackSystem('app_init_started', { 
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    online: navigator.onLine
  });

  await registerServiceWorker();
  await hydrateFromOfflineSnapshot();
  await refreshGeolocationPermission();
  logVisit();
  initDates();
  if (state.gps.permission !== 'denied') {
    requestClientLocation('init', { forcePrompt: false, timeout: 7000 }).catch(() => null);
  }
  hydrateAccount();
  renderConnectivity();
  renderDiscount();
  bindEvents();
  initializeGoogleIdentity().catch(() => null);
  initializeGooglePlaces().catch(() => null);
  renderResults();
  renderBooking();
  persistOfflineSnapshot().catch(() => null);

  // Initialize action tracking dashboard
  renderRecentActions();
  updateActionStats();
  
  // Add listener to update dashboard on new actions
  ActionTracker.addListener(() => {
    renderRecentActions();
    updateActionStats();
  });

  ActionTracker.trackSystem('app_init_completed', {
    hasAccount: !!state.account,
    accountType: state.account?.type || null,
    hasBooking: !!state.booking,
    visitCount: state.visitLog.length,
    actionLogCount: state.actionLog.length
  });
}

init().catch(() => null);
