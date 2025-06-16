class MenuItem:
    """
    Represents an item in the Jinx strategy game menu.

    Attributes:
        name (str): The display name of the menu item.
        handler (callable): The function to call when the item is selected.
                            This function should not take any arguments.
    """
    def __init__(self, name: str, handler: callable):
        """
        Initializes a new MenuItem.

        Args:
            name: The display name of the menu item.
            handler: The function to call when the item is selected.
        """
        if not isinstance(name, str) or not name:
            raise ValueError("Menu item name must be a non-empty string.")
        if not callable(handler):
            raise TypeError("Menu item handler must be a callable function.")

        self.name = name
        self.handler = handler

    def __str__(self) -> str:
        """
        Returns the string representation of the menu item (its name).
        """
        return self.name

    def select(self) -> None:
        """
        Executes the handler associated with this menu item.
        """
        try:
            self.handler()
        except Exception as e:
            # Handle potential errors during handler execution
            print(f"Error executing menu item '{self.name}': {e}")
            # Depending on the desired behavior, you might want to re-raise, log, or handle differently.

if __name__ == '__main__':
    # Example Usage (optional, for testing the MenuItem class directly)
    def sample_action_1():
        print("Action 1 selected!")

    def sample_action_2():
        print("Action 2 selected!")

    item1 = MenuItem("Start Game", sample_action_1)
    item2 = MenuItem("Options", sample_action_2)
    item3 = MenuItem("Exit", lambda: print("Exit selected!"))

    print(f"Item 1: {item1}")
    print(f"Item 2: {item2}")
    print(f"Item 3: {item3}")

    print(f"\nSelecting {item1.name}...")
    item1.select()

    print(f"\nSelecting {item2.name}...")
    item2.select()

    print(f"\nSelecting {item3.name}...")
    item3.select()

    # Test error handling
    def faulty_action():
        raise ValueError("Something went wrong in this action")

    faulty_item = MenuItem("Faulty Action", faulty_action)
    print(f"\nSelecting {faulty_item.name}...")
    faulty_item.select()

    try:
        MenuItem("", sample_action_1)
    except ValueError as e:
        print(f"\nError creating item with empty name: {e}")

    try:
        MenuItem("Valid Name", "not a function")
    except TypeError as e:
        print(f"\nError creating item with invalid handler: {e}")
