import json
from html.parser import HTMLParser

class NextDataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_script = False
        self.data = None

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            for name, value in attrs:
                if name == 'id' and value == '__NEXT_DATA__':
                    self.in_script = True

    def handle_data(self, data):
        if self.in_script:
            self.data = data

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False

with open(r'C:\Users\gambi\Documents\Git\AraliaV4\Aralia\misc\mdi_page.html', 'r', encoding='utf-8') as f:
    parser = NextDataParser()
    parser.feed(f.read())
    if parser.data:
        with open(r'C:\Users\gambi\Documents\Git\AraliaV4\Aralia\misc\next_data.json', 'w', encoding='utf-8') as out:
            out.write(parser.data)
        print("Success: Captured to misc/next_data.json")
    else:
        print("No __NEXT_DATA__ found")
