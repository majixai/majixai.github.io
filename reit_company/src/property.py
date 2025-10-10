import asyncio

# Decorator for logging method calls
def log_method_call(func):
    def wrapper(*args, **kwargs):
        print(f"Calling method: {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

class Property:
    """Represents a real estate property."""
    def __init__(self, address, price, property_type):
        self.address = address  # Public member
        self._property_type = property_type  # Protected member
        self.__price = price  # Private member

    @log_method_call
    def get_price(self):
        """Returns the price of the property."""
        return self.__price

    @log_method_call
    def set_price(self, new_price):
        """Sets a new price for the property."""
        if new_price > 0:
            self.__price = new_price
        else:
            print("Price must be positive.")

    def get_property_type(self):
        """Returns the property type."""
        return self._property_type

# A custom collection class for properties
class PropertyPortfolio:
    """A collection of properties that acts as an iterator."""
    def __init__(self):
        self._properties = []

    def add_property(self, property_instance):
        self._properties.append(property_instance)

    def __iter__(self):
        self.index = 0
        return self

    def __next__(self):
        if self.index < len(self._properties):
            result = self._properties[self.index]
            self.index += 1
            return result
        else:
            raise StopIteration

# A generator function to yield properties
def property_generator(portfolio):
    """A generator that yields each property from the portfolio."""
    for prop in portfolio:
        yield prop

# Async function to simulate fetching data
async def fetch_property_data(property_id):
    """Simulates fetching property data asynchronously."""
    print(f"Fetching data for property {property_id}...")
    await asyncio.sleep(2)  # Simulate network delay
    print(f"Data for property {property_id} fetched.")
    return {"id": property_id, "details": "Some details about the property."}

if __name__ == '__main__':
    # Example Usage
    prop1 = Property("123 Main St", 500000, "Residential")
    prop2 = Property("456 Oak Ave", 750000, "Commercial")

    print(f"Address: {prop1.address}")
    print(f"Price: {prop1.get_price()}")
    prop1.set_price(550000)
    print(f"New Price: {prop1.get_price()}")

    portfolio = PropertyPortfolio()
    portfolio.add_property(prop1)
    portfolio.add_property(prop2)

    print("\nIterating through portfolio:")
    for prop in portfolio:
        print(f"- {prop.address}")

    print("\nUsing property generator:")
    for prop in property_generator(portfolio):
        print(f"- {prop.address}")

    async def main():
        task = asyncio.create_task(fetch_property_data(101))
        await task

    print("\nRunning async data fetch:")
    asyncio.run(main())