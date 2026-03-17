import java.util.Scanner;
import java.util.Random;

public class HelloWorld {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Random rand = new Random();

        int secret = rand.nextInt(10) + 1;
        int guess = 0;
        int tries = 0;

        System.out.println(" Guess a number between 1 and 10");

        while (guess != secret) {
            System.out.print("Enter your guess: ");
            guess = sc.nextInt();
            tries++;

            if (guess < secret) {
                System.out.println("Too low!");
            } else if (guess > secret) {
                System.out.println("Too high!");
            } else {
                System.out.println(" Correct! You found it in " + tries + " tries!");
            }
        }
        sc.close();
    }
}
