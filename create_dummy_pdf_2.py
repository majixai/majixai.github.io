from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="This is another dummy PDF to test the GitHub Action.", ln=1, align="C")
pdf.output("investing_blog/pdfs/dummy2.pdf")