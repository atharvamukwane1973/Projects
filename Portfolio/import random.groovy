import random

quotes = [
    "Keep going 💪",
    "Small progress matters 🚀",
    "Consistency beats talent 🔥"
]

questions = {
    "python": [
        "What is a loop?",
        "What is a list?"
    ],
    "math": [
        "What is Pythagoras theorem?",
        "What is derivative?"
    ]
}

print("===== AI STUDY BUDDY =====")

name = input("Enter your name: ")
subject = input("What are you studying? ").lower()

print("\nHello", name)
print(random.choice(quotes))

if subject in questions:
    print("\nQuiz Questions:")

    for q in questions[subject]:
        print("-", q)

else:
    print("Subject not available")

notes = input("\nWrite short study note: ")

with open("notes.txt", "a") as file:
    file.write(notes + "\n")

print("Notes saved successfully ✅")    