import unittest
import asyncio
from reit_company.src.property import Property, PropertyPortfolio, property_generator, fetch_property_data

class TestProperty(unittest.TestCase):

    def test_property_creation(self):
        prop = Property("123 Test St", 100000, "Test Type")
        self.assertEqual(prop.address, "123 Test St")
        self.assertEqual(prop.get_price(), 100000)
        self.assertEqual(prop.get_property_type(), "Test Type")

    def test_property_price_change(self):
        prop = Property("123 Test St", 100000, "Test Type")
        prop.set_price(120000)
        self.assertEqual(prop.get_price(), 120000)
        prop.set_price(-50)
        self.assertEqual(prop.get_price(), 120000) # Price should not change

    def test_property_portfolio_iteration(self):
        portfolio = PropertyPortfolio()
        prop1 = Property("111 A St", 100, "A")
        prop2 = Property("222 B St", 200, "B")
        portfolio.add_property(prop1)
        portfolio.add_property(prop2)

        addresses = [prop.address for prop in portfolio]
        self.assertEqual(addresses, ["111 A St", "222 B St"])

    def test_property_generator(self):
        portfolio = PropertyPortfolio()
        prop1 = Property("333 C St", 300, "C")
        prop2 = Property("444 D St", 400, "D")
        portfolio.add_property(prop1)
        portfolio.add_property(prop2)

        gen = property_generator(portfolio)
        self.assertEqual(next(gen).address, "333 C St")
        self.assertEqual(next(gen).address, "444 D St")

    def test_async_fetch(self):
        async def run_test():
            data = await fetch_property_data(202)
            self.assertEqual(data, {"id": 202, "details": "Some details about the property."})

        asyncio.run(run_test())

if __name__ == '__main__':
    unittest.main()