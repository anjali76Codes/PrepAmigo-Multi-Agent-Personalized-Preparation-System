from agents.base import BaseAgent
from prompts.system_prompts import FLIGHT_BOOKING_PROMPT
from tools.search_tools import search_flights


class FlightBookingAgent(BaseAgent):
    name = "flight_booking"
    system_prompt = FLIGHT_BOOKING_PROMPT
    tools = [search_flights]
