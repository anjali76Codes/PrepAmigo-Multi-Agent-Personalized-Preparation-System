export const mockTripData = {
  id: 'trip_rome',
  destination: 'Rome, Italy',
  dates: '12 Sep - 17 Sep',
  travelers: 2,
  budget: {
    total: 120000,
    spent: 45000,
    currency: '₹',
  },
  status: 'Needs Attention',
  disruption: 'Cancelled flight',
  nodes: [
    { id: 'flight_1', type: 'Flight', title: 'JFK to FCO (AF123)', time: '14:00', status: 'cancelled' },
    { id: 'transfer_1', type: 'Transfer', title: 'Airport Transfer', time: '16:30', status: 'impacted' },
    { id: 'hotel_1', type: 'Accommodation', title: 'Hotel Check-in', time: '17:15', status: 'impacted' },
    { id: 'dinner_1', type: 'Dining', title: 'Dinner at Trattoria', time: '19:00', status: 'impacted' },
    { id: 'activity_1', type: 'Activity', title: 'Colosseum Tour', time: 'Tomorrow, 09:00', status: 'safe' },
  ],
  itinerary: [
    {
      day: 'Day 1 - 12 Sep',
      items: [
        { id: 'i1', title: 'Flight to Rome', time: '14:00', status: 'cancelled', icon: 'airplane-outline' },
        { id: 'i2', title: 'Airport transfer', time: '16:30', status: 'impacted', icon: 'car-outline' },
        { id: 'i3', title: 'Hotel check-in', time: '17:15', status: 'impacted', icon: 'bed-outline' },
        { id: 'i4', title: 'Dinner', time: '19:00', status: 'impacted', icon: 'restaurant-outline' }
      ]
    },
    {
      day: 'Day 2 - 13 Sep',
      items: [
        { id: 'i5', title: 'Breakfast', time: '08:00', status: 'safe', icon: 'cafe-outline' },
        { id: 'i6', title: 'Colosseum Tour', time: '09:00', status: 'safe', icon: 'compass-outline' },
        { id: 'i7', title: 'Lunch', time: '13:00', status: 'safe', icon: 'restaurant-outline' },
        { id: 'i8', title: 'Vatican City', time: '15:00', status: 'safe', icon: 'business-outline' },
        { id: 'i9', title: 'Dinner', time: '20:00', status: 'safe', icon: 'wine-outline' }
      ]
    }
  ],
  affectedItems: [
    { id: 'a1', title: 'Flight', description: 'Cancelled', status: 'error' },
    { id: 'a2', title: 'Airport Transfer', description: 'Needs rescheduling', status: 'warning' },
    { id: 'a3', title: 'Hotel', description: 'Check-in time may need adjustment', status: 'warning' },
    { id: 'a4', title: 'Dinner', description: 'Reservation may need timing review', status: 'warning' }
  ],
  activityHistory: [
    { id: 'h1', description: 'Flight cancellation detected', time: '14:02' },
    { id: 'h2', description: 'kaju identified affected bookings', time: '14:02' },
    { id: 'h3', description: 'Airport transfer marked for review', time: '14:03' },
    { id: 'h4', description: 'Hotel check-in flagged', time: '14:03' },
    { id: 'h5', description: 'Dinner timing flagged', time: '14:03' }
  ]
};

export const mockTrips = [
  {
    id: 'trip_rome',
    destination: 'Rome, Italy',
    dates: '12 Sep - 17 Sep',
    travelers: 2,
    budget: { total: 120000, currency: '₹' },
    status: 'Needs Attention',
    disruption: 'Cancelled flight',
    icon: 'business-outline' 
  },
  {
    id: 'trip_goa',
    destination: 'Goa, India',
    dates: '20 Oct - 24 Oct',
    travelers: 3,
    budget: { total: 60000, currency: '₹' },
    status: 'Upcoming',
    icon: 'water-outline' 
  },
  {
    id: 'trip_paris',
    destination: 'Paris, France',
    dates: '05 Jun - 12 Jun',
    travelers: 2,
    budget: { total: 150000, currency: '₹' },
    status: 'Completed',
    icon: 'cafe-outline' 
  }
];

export const mockChatMessages = [
  {
    id: 'msg_1',
    role: 'user',
    content: "kaju, my flight to Rome was cancelled. Get me there tonight and keep tomorrow's plans intact.",
    timestamp: '14:05',
  },
  {
    id: 'msg_2',
    role: 'assistant',
    content: "Got it. I'm checking the rest of your trip to see what this affects.",
    timestamp: '14:05',
    isThinking: true,
  }
];

export const mockAgents = [
  { id: 'agent_flight', name: 'Flight', icon: 'airplane-outline', status: 'active' },
  { id: 'agent_hotel', name: 'Accommodation', icon: 'bed-outline', status: 'active' },
  { id: 'agent_transfer', name: 'Transportation', icon: 'car-outline', status: 'active' },
  { id: 'agent_dining', name: 'Dining', icon: 'restaurant-outline', status: 'idle' },
];

export const mockBookings = [
  {
    id: 'bk_1',
    tripId: 'trip_rome',
    tripName: 'Rome, Italy',
    type: 'Flight',
    icon: 'airplane-outline',
    name: 'Air France AF123',
    date: '12 Sep • 14:00',
    location: 'JFK to FCO',
    status: 'Cancelled',
  },
  {
    id: 'bk_2',
    tripId: 'trip_rome',
    tripName: 'Rome, Italy',
    type: 'Accommodation',
    icon: 'bed-outline',
    name: 'Hotel de Russie',
    date: '12 Sep - 17 Sep',
    location: 'Via del Babuino, 9, Rome',
    status: 'Confirmed',
  },
  {
    id: 'bk_3',
    tripId: 'trip_rome',
    tripName: 'Rome, Italy',
    type: 'Transfer',
    icon: 'car-outline',
    name: 'Private Airport Transfer',
    date: '12 Sep • 16:30',
    location: 'FCO to Hotel',
    status: 'Pending update',
  },
  {
    id: 'bk_4',
    tripId: 'trip_rome',
    tripName: 'Rome, Italy',
    type: 'Dining',
    icon: 'restaurant-outline',
    name: 'Dinner at Trattoria',
    date: '12 Sep • 19:00',
    location: 'Trastevere, Rome',
    status: 'Confirmed',
  }
];

export const mockBudget = {
  tripId: 'trip_rome',
  tripName: 'Rome, Italy',
  currency: '₹',
  total: 120000,
  spent: 45000,
  categories: [
    { name: 'Flights', icon: 'airplane-outline', allocated: 50000, spent: 25000 },
    { name: 'Accommodation', icon: 'bed-outline', allocated: 40000, spent: 15000 },
    { name: 'Transport', icon: 'car-outline', allocated: 5000, spent: 1000 },
    { name: 'Food', icon: 'restaurant-outline', allocated: 15000, spent: 2000 },
    { name: 'Activities', icon: 'compass-outline', allocated: 10000, spent: 2000 },
  ]
};

export const mockNotifications = [
  {
    id: 'notif_1',
    title: 'Flight cancellation detected',
    description: 'Your flight AF123 to Rome has been cancelled.',
    time: '2 hours ago',
    read: false,
    icon: 'airplane-outline',
    type: 'error'
  },
  {
    id: 'notif_2',
    title: 'Hotel check-in may be affected',
    description: 'kaju is reviewing your hotel check-in time due to the flight change.',
    time: '2 hours ago',
    read: false,
    icon: 'bed-outline',
    type: 'warning'
  },
  {
    id: 'notif_3',
    title: 'Airport transfer needs review',
    description: 'Your private transfer at FCO needs to be rescheduled.',
    time: '2 hours ago',
    read: false,
    icon: 'car-outline',
    type: 'warning'
  },
  {
    id: 'notif_4',
    title: 'Dinner reservation timing',
    description: 'Your reservation at Trattoria may need attention.',
    time: '3 hours ago',
    read: true,
    icon: 'restaurant-outline',
    type: 'info'
  },
  {
    id: 'notif_5',
    title: 'Trip updated by kaju',
    description: 'Your itinerary for Paris has been finalized.',
    time: '1 day ago',
    read: true,
    icon: 'sparkles-outline',
    type: 'success'
  }
];
