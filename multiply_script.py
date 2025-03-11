# multiply_script.py

def multiply_numbers(num1, num2):
  """
  Multiplies two numbers and returns the result.

  Args:
    num1: The first number (integer or float).
    num2: The second number (integer or float).

  Returns:
    The product of num1 and num2.
  """
  result = num1 * num2
  return result

if __name__ == "__main__":
  number1 = 2000000
  number2 = 13579

  product = multiply_numbers(number1, number2)

  print(f"The Jinx product of {number1} and {number2} is: {product}")
