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
