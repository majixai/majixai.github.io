from typing import List, Optional
from .menu_item import MenuItem

class MenuManager:
    """
    Manages a list of menu items and handles user interaction for menu navigation.

    Attributes:
        items (List[MenuItem]): A list of MenuItem objects.
        _current_selection (int): The index of the currently selected menu item.
    """

    def __init__(self, items: Optional[List[MenuItem]] = None):
        """
        Initializes a new MenuManager.

        Args:
            items: An optional list of MenuItem objects to populate the menu.
        """
        self.items = items if items is not None else []
        self._current_selection = 0 # Default to the first item

        if not all(isinstance(item, MenuItem) for item in self.items):
            raise TypeError("All items in MenuManager must be MenuItem instances.")

    def add_item(self, item: MenuItem) -> None:
        """
        Adds a MenuItem to the menu.

        Args:
            item: The MenuItem object to add.

        Raises:
            TypeError: If the provided item is not a MenuItem instance.
        """
        if not isinstance(item, MenuItem):
            raise TypeError("Only MenuItem instances can be added to the menu.")
        self.items.append(item)

    def display_menu(self) -> None:
        """
        Displays the menu to the user, highlighting the current selection.
        """
        if not self.items:
            print("Menu is empty.")
            return

        print("\nJinx Strategy Game Menu:")
        print("-" * 25)
        for index, item in enumerate(self.items):
            prefix = "> " if index == self._current_selection else "  "
            print(f"{prefix}{index + 1}. {item.name}")
        print("-" * 25)

    def navigate_up(self) -> None:
        """
        Moves the current selection up in the menu.
        Wraps around to the bottom if at the top.
        """
        if not self.items:
            return
        self._current_selection = (self._current_selection - 1 + len(self.items)) % len(self.items)

    def navigate_down(self) -> None:
        """
        Moves the current selection down in the menu.
        Wraps around to the top if at the bottom.
        """
        if not self.items:
            return
        self._current_selection = (self._current_selection + 1) % len(self.items)

    def select_current_item(self) -> None:
        """
        Executes the handler of the currently selected menu item.
        """
        if not self.items:
            print("Cannot select from an empty menu.")
            return
        if 0 <= self._current_selection < len(self.items):
            selected_item = self.items[self._current_selection]
            print(f"\nSelecting '{selected_item.name}'...")
            selected_item.select()
        else:
            # This case should ideally not be reached if _current_selection is managed correctly
            print("Error: Invalid selection.")

    def run_menu_loop(self) -> None:
        """
        Runs the main interactive menu loop.
        Allows user to navigate and select menu items.
        """
        if not self.items:
            print("Menu is empty. Nothing to display or select.")
            return

        while True:
            self.display_menu()
            print("Controls: 'u' (up), 'd' (down), 's' (select), 'q' (quit)")
            choice = input("Enter your choice: ").strip().lower()

            if choice == 'u':
                self.navigate_up()
            elif choice == 'd':
                self.navigate_down()
            elif choice == 's':
                self.select_current_item()
                # If the selected item was an "Exit" or similar,
                # the handler might terminate the program.
                # For other items, we might want to break or continue based on the action.
                # For this example, we'll assume most selections return to the menu.
                # If an action implies exiting, its handler should call sys.exit() or similar.
            elif choice == 'q':
                print("Exiting menu...")
                break
            else:
                print("Invalid choice. Please try again.")

if __name__ == '__main__':
    # Example Usage
    def start_game_action():
        print("Starting the game... (Not implemented yet)")

    def open_settings_action():
        print("Opening settings... (Not implemented yet)")

    def exit_action():
        print("Exiting program via menu action.")
        # In a real application, this might set a flag or directly call sys.exit()
        # For this example, we'll just print and let the loop be quit by 'q'

    # Create menu items
    item1 = MenuItem("Start New Game", start_game_action)
    item2 = MenuItem("Settings", open_settings_action)
    item3 = MenuItem("Exit Game", exit_action) # This action itself doesn't quit the loop

    # Create menu manager and add items
    manager = MenuManager()
    manager.add_item(item1)
    manager.add_item(item2)
    manager.add_item(item3)

    # Add a faulty item for testing
    def faulty_action_menu():
        raise RuntimeError("This action is faulty!")
    faulty_item = MenuItem("Test Faulty Action", faulty_action_menu)
    manager.add_item(faulty_item)


    # Test adding non-MenuItem
    try:
        manager.add_item("Not a MenuItem")
    except TypeError as e:
        print(f"\nError adding invalid item: {e}")

    # Run the menu loop
    # manager.run_menu_loop() # Uncomment to run interactive loop

    # For non-interactive testing of navigation and selection:
    print("\n--- Non-interactive test ---")
    manager.display_menu()

    manager.navigate_down() # Select "Settings"
    print(f"Current selection index: {manager._current_selection} (Item: {manager.items[manager._current_selection].name})")
    manager.display_menu()


    manager.navigate_up() # Select "Start New Game"
    print(f"Current selection index: {manager._current_selection} (Item: {manager.items[manager._current_selection].name})")
    manager.display_menu()

    manager.select_current_item() # Execute "Start New Game"

    manager.navigate_down() # Select "Settings"
    manager.navigate_down() # Select "Exit Game"
    manager.select_current_item() # Execute "Exit Game"

    manager.navigate_down() # Select "Test Faulty Action"
    manager.select_current_item() # Execute "Test Faulty Action" (should print error)


    print("\n--- Test with initially empty menu ---")
    empty_manager = MenuManager()
    empty_manager.display_menu()
    empty_manager.select_current_item()
    empty_manager.run_menu_loop() # Should state menu is empty and exit or not start

    print("\n--- Test with items passed to constructor ---")
    constructor_manager = MenuManager([item1, item2])
    constructor_manager.display_menu()

    print("\n--- Test error in constructor ---")
    try:
        error_manager = MenuManager([item1, "not an item"])
    except TypeError as e:
        print(f"Caught expected error: {e}")

    print("\nMenu system basic tests complete.")
