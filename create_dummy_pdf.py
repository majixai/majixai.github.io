from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="This is a dummy PDF for testing the upload functionality.", ln=1, align="C")
pdf.output("dummy.pdf")