import { useState } from 'react';
import type { FlashcardDeck as FlashcardDeckType } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

export function FlashcardDeck({ deck }: { deck: FlashcardDeckType }) {
  const [flipped, setFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsLeft, setCardsLeft] = useState(deck.cards.length);

  const card = deck.cards[currentIndex];

  const handleNext = () => {
    setFlipped(false);
    setTimeout(() => {
      setCardsLeft(prev => Math.max(0, prev - 1));
      if (currentIndex < deck.cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }, 150);
  };

  return (
    <Card className="p-6 bg-surface border-border">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h4 className="font-semibold text-lg text-primary-text">{deck.topic}</h4>
          <p className="text-sm text-secondary-text">{cardsLeft} cards due for revision</p>
        </div>
        {deck.dueForRevision && cardsLeft > 0 && (
          <span className="text-xs bg-warning/10 text-warning px-3 py-1 rounded-full border border-warning/20 font-medium">
            Due Today
          </span>
        )}
      </div>

      {cardsLeft > 0 && card ? (
        <div className="space-y-6">
          <div 
            className="min-h-[200px] flex items-center justify-center p-8 bg-background border border-border rounded-xl cursor-pointer hover:border-primary/30 transition-all text-center"
            onClick={() => setFlipped(!flipped)}
          >
            <p className="text-lg text-primary-text font-medium">
              {flipped ? card.back : card.front}
            </p>
          </div>
          
          <div className="flex justify-center gap-4">
            {!flipped ? (
              <Button onClick={() => setFlipped(true)}>Show Answer</Button>
            ) : (
              <>
                <Button variant="secondary" className="border-warning text-warning hover:bg-warning/10" onClick={handleNext}>
                  Review Again
                </Button>
                <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleNext}>
                  Got It
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-secondary-text">
          <Icon name="checkmark-circle-outline" className="text-4xl text-primary mb-4" />
          <p>You're all caught up with this deck!</p>
        </div>
      )}
    </Card>
  );
}
